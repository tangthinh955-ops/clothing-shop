import { seller } from '../../../shared/shop';

export interface PolicySection {
  heading: string;
  paragraphs: string[];
}

export interface PolicyContent {
  path: string;
  title: string;
  sections: PolicySection[];
}

function contactLines() {
  return [
    `Cửa hàng: ${seller.name}`,
    `Người bán: ${seller.owner}`,
    `Khu vực: ${seller.city}`,
    ...(seller.phone ? [`Điện thoại/Zalo: ${seller.phone}`] : []),
    ...(seller.email ? [`Email: ${seller.email}`] : []),
  ];
}

export const policyPages: readonly PolicyContent[] = [
  { path: 'size-guide', title: 'Hướng dẫn chọn size', sections: [
    { heading: 'Cách chọn size', paragraphs: [
      'Đối chiếu số đo của bạn với bảng size riêng của từng sản phẩm.',
      'Nếu chưa chắc chắn, hãy nhắn tin cho shop qua Instagram trước khi đặt hàng để được tư vấn.',
    ] },
  ] },
  { path: 'contact', title: 'Liên hệ', sections: [
    { heading: 'Thông tin người bán', paragraphs: contactLines() },
    { heading: 'Kênh liên hệ', paragraphs: [
      'Nhắn tin cho shop qua Instagram để hỏi size, tình trạng đơn hàng hoặc đổi trả.',
    ] },
  ] },
  { path: 'shipping', title: 'Giao hàng', sections: [
    { heading: 'Phạm vi và phí giao', paragraphs: [
      'Shop giao hàng toàn quốc qua đơn vị vận chuyển.',
      'Phí giao cố định 30.000đ mỗi đơn, hiển thị trước khi bạn xác nhận đặt hàng.',
    ] },
    { heading: 'Thời gian dự kiến', paragraphs: [
      'TP. Hồ Chí Minh: 1–2 ngày làm việc. Tỉnh thành khác: 2–5 ngày làm việc.',
      'Thời gian có thể thay đổi vào dịp lễ hoặc do đơn vị vận chuyển.',
    ] },
    { heading: 'Nhận hàng', paragraphs: [
      'Bạn được kiểm hàng trước khi thanh toán với đơn COD.',
    ] },
  ] },
  { path: 'returns-policy', title: 'Đổi & trả', sections: [
    { heading: 'Điều kiện', paragraphs: [
      'Shop nhận đổi trả trong 7 ngày kể từ khi bạn nhận hàng.',
      'Sản phẩm còn tag, chưa giặt và chưa mặc ra ngoài.',
    ] },
    { heading: 'Phí đổi trả', paragraphs: [
      'Đổi size hoặc màu theo nhu cầu: khách trả phí vận chuyển hai chiều, đổi khi sản phẩm còn hàng.',
      'Hàng lỗi hoặc giao sai: shop chịu phí, đổi sản phẩm mới hoặc hoàn tiền.',
    ] },
    { heading: 'Cách gửi yêu cầu', paragraphs: [
      'Nhắn tin cho shop qua Instagram kèm mã đơn và ảnh hoặc video lúc mở hàng.',
      'Tiền hoàn được chuyển khoản sau khi shop nhận lại và kiểm tra sản phẩm.',
    ] },
  ] },
  { path: 'payment', title: 'Thanh toán', sections: [
    { heading: 'Hình thức thanh toán', paragraphs: [
      'Thanh toán khi nhận hàng (COD).',
      'Chuyển khoản ngân hàng bằng mã VietQR hiển thị sau khi đặt hàng, với nội dung chuyển khoản là mã đơn.',
    ] },
    { heading: 'Hạn chuyển khoản', paragraphs: [
      'Đơn chuyển khoản được giữ hàng trong 2 giờ. Quá hạn mà shop chưa nhận được tiền, đơn tự hủy.',
      'Shop xác nhận đơn khi đã nhận đủ tiền. Website không thu thông tin thẻ của bạn.',
    ] },
  ] },
  { path: 'privacy', title: 'Chính sách bảo mật', sections: [
    { heading: 'Thông tin shop thu thập', paragraphs: [
      'Khi bạn đặt hàng: họ tên, số điện thoại, địa chỉ nhận hàng và email (không bắt buộc).',
      'Bạn không cần tạo tài khoản để đặt hàng.',
    ] },
    { heading: 'Mục đích sử dụng', paragraphs: [
      'Xử lý đơn hàng, giao hàng và liên hệ với bạn về đơn hàng.',
      'Shop chỉ chia sẻ phần thông tin cần thiết cho đơn vị vận chuyển để giao hàng và không bán thông tin của bạn.',
    ] },
    { heading: 'Lưu trữ và quyền của bạn', paragraphs: [
      'Thông tin được lưu trong thời gian cần thiết để xử lý đơn hàng và theo nghĩa vụ pháp luật.',
      'Bạn có thể liên hệ shop để xem hoặc xóa thông tin cá nhân; dữ liệu của đơn đã phát sinh nghĩa vụ thanh toán có thể cần được giữ lại.',
    ] },
    { heading: 'Cookie', paragraphs: [
      'Website chỉ dùng cookie kỹ thuật cho việc đăng nhập quản trị. Giỏ hàng được lưu trên trình duyệt của bạn.',
    ] },
  ] },
];
