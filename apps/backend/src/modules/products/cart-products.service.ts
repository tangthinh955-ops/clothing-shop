import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Normalized limits shared with the frontend cart store and the contract. */
export const CART_LINES_LIMIT = 50;
export const CART_QUANTITY_LIMIT = 99;

export type CartResolveStatus = 'AVAILABLE' | 'EXCEEDS_STOCK' | 'OUT_OF_STOCK' | 'UNAVAILABLE';

/** Public catalog data for a variant that is still publicly sellable. */
export interface CartAvailableItem {
  variantId: string;
  status: 'AVAILABLE' | 'EXCEEDS_STOCK' | 'OUT_OF_STOCK';
  /** Current sellable stock (onHand − reserved, never negative) read at resolve time. */
  available: number;
  product: { name: string; slug: string };
  sku: string;
  size: string;
  color: string;
  price: number;
  image: { url: string } | null;
}

/** A variant that can no longer be bought: draft/hidden product, inactive category or variant, unknown id. */
export interface CartUnavailableItem {
  variantId: string;
  status: 'UNAVAILABLE';
}

export type CartResolveItem = CartAvailableItem | CartUnavailableItem;
export interface CartResolveView { items: CartResolveItem[] }

interface CartRequestItem { variantId: string; quantity: number }

function invalid(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

@Injectable()
export class CartProductsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** Read-only: maps guest cart ids to public catalog data. Never reserves or writes stock/quotes. */
  async resolve(dto: { items: CartRequestItem[] }): Promise<CartResolveView> {
    // Duplicate rows merge first so the limits are judged on normalized data: exceeding them is
    // reported instead of silently cutting, keeping the per-operation guarantees of the cart UI.
    const merged = new Map<string, number>();
    for (const { variantId: rawId, quantity } of dto.items) {
      const variantId = rawId.toLowerCase();
      const total = (merged.get(variantId) ?? 0) + quantity;
      if (total > CART_QUANTITY_LIMIT) throw invalid('Một sản phẩm chỉ được tối đa 99 chiếc trong giỏ.');
      merged.set(variantId, total);
    }
    if (merged.size > CART_LINES_LIMIT) throw invalid('Giỏ chỉ chứa tối đa 50 dòng sau khi gộp.');
    if (merged.size === 0) return { items: [] };

    // One batched query; nothing mutating here.
    const rows = await this.db.variant.findMany({
      where: { id: { in: [...merged.keys()] } },
      select: { id: true, sku: true, size: true, color: true, price: true, active: true,
        inventory: { select: { onHand: true, reserved: true } },
        product: { select: { name: true, slug: true, status: true, category: { select: { active: true } },
          images: { orderBy: { position: 'asc' }, take: 1, select: { assetId: true } } } } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    // The reply keeps the first-occurrence order of the request, one item per distinct variantId.
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    for (const { variantId: rawId } of dto.items) {
      const variantId = rawId.toLowerCase();
      if (!seen.has(variantId)) { seen.add(variantId); orderedIds.push(variantId); }
    }
    const items: CartResolveItem[] = orderedIds.map((id) => {
      const row = byId.get(id);
      if (!row || !row.active || row.product.status !== 'PUBLISHED' || !row.product.category.active) {
        // Same uniform status for unknown, draft/hidden, inactive variant or inactive category —
        // deliberately without name/price/sku/size/color/image or internal reasons.
        return { variantId: id, status: 'UNAVAILABLE' };
      }
      const available = Math.max(0, (row.inventory?.onHand ?? 0) - (row.inventory?.reserved ?? 0));
      const quantity = merged.get(id) ?? 0;
      const status = quantity <= available ? 'AVAILABLE' : available > 0 ? 'EXCEEDS_STOCK' : 'OUT_OF_STOCK';
      const image = row.product.images[0];
      return { variantId: id, status, available, product: { name: row.product.name, slug: row.product.slug },
        sku: row.sku, size: row.size, color: row.color, price: Number(row.price),
        image: image ? { url: `/api/v1/media/${image.assetId}` } : null };
    });
    return { items };
  }
}
