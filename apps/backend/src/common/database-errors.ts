import { ConflictException, NotFoundException } from '@nestjs/common';

export function conflict(message = 'Dữ liệu đã thay đổi hoặc bị trùng. Hãy tải lại rồi thử lại.'): never {
  throw new ConflictException({ code: 'CONFLICT', message });
}
// A business rule blocked the change (not a stale version or duplicate), so clients should show the message as is.
export function publishRuleConflict(message: string): never {
  throw new ConflictException({ code: 'PUBLISH_RULE', message });
}
export function databaseError(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'P2002') conflict('SKU, đường dẫn hoặc tổ hợp size/màu đã được sử dụng.');
    if (error.code === 'P2003') conflict('Dữ liệu liên quan không còn hợp lệ. Hãy tải lại.');
    if (error.code === 'P2025') throw new NotFoundException();
  }
  throw error;
}
