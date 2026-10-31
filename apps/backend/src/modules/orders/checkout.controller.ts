import { Body, Controller, Inject, Post } from '@nestjs/common';
import { CheckoutQuoteDto } from './dto/quote.dto.js';
import { CheckoutService } from './checkout.service.js';

// Guest checkout preview (m4-contract §5 Quote): CSRF, origin checks and the global rate limiter
// apply to this write-shaped route exactly like every other mutation; no session is required.
@Controller('checkout')
export class CheckoutController {
  constructor(@Inject(CheckoutService) private readonly checkout: CheckoutService) {}

  @Post('quote')
  quote(@Body() dto: CheckoutQuoteDto) {
    return this.checkout.quote(dto);
  }
}
