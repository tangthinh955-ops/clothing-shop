export interface PolicyContent {
  path: string;
  title: string;
  text: string;
}

export const policyPages: readonly PolicyContent[] = [
  { path: 'size-guide', title: 'Hướng dẫn chọn size', text: 'Đối chiếu số đo với bảng size riêng của từng sản phẩm. Nếu chưa chắc chắn, hãy liên hệ cửa hàng trước khi chọn.' },
  { path: 'contact', title: 'Liên hệ', text: 'Thông tin liên hệ của cửa hàng sẽ được bổ sung khi nghiệm thu bản demo.' },
  { path: 'shipping', title: 'Giao hàng', text: 'Giả định demo: phí giao 30.000đ mỗi đơn, được hiển thị trước khi xác nhận. Chưa có cam kết thời gian vận chuyển cho bản demo.' },
  { path: 'returns-policy', title: 'Đổi & trả', text: 'Giả định demo: gửi yêu cầu trong 7 ngày từ khi giao thành công. Đổi size cùng sản phẩm và màu, hàng được kiểm tra trước khi xử lý. Phí giao gốc mặc định không hoàn. Chính sách này chưa được shop duyệt để bán thật.' },
];
