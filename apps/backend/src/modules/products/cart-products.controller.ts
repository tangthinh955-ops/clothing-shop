import { Body, Controller, Get, HttpCode, Inject, Post, HttpStatus } from '@nestjs/common';
import { CartResolveDto } from './dto/cart-items.dto.js';
import { CartProductsService } from './cart-products.service.js';

// Public guest endpoint: like every non-GET route it passes the CSRF guard, and it needs no
// session. The resolver only maps cart ids to public data; it never reserves stock or creates
// quotes, so no Idempotency-Key is required here.
@Controller('cart')
export class CartProductsController {
  constructor(@Inject(CartProductsService) private readonly cart: CartProductsService) {}

  // Read-shaped POST: answer 200 like a read, not 201 which implies a created resource.
  @HttpCode(HttpStatus.OK)
  @Post('resolve')
  resolve(@Body() dto: CartResolveDto) {
    return this.cart.resolve(dto);
  }
}
