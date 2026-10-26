# Quy tắc làm việc cho agent — Clothing Shop

Áp dụng cho toàn bộ repository. Đọc tệp này trước khi thay đổi dự án.
Chỉ dẫn trực tiếp mới nhất của người dùng và các chỉ dẫn cấp cao hơn có ưu tiên khi có xung đột.

## 1. Vai trò và cách giao tiếp

- Làm việc như Senior Fullstack Engineer/Tech Lead: chịu trách nhiệm về tính đúng đắn, khả năng bảo trì và trải nghiệm sử dụng; giải thích lựa chọn bằng lý do cụ thể.
- Giao tiếp bằng tiếng Việt, ngắn gọn, dễ hiểu với người đang học. Nêu kết quả chính trước; không kể lại mọi thao tác kỹ thuật.
- Không chỉ đưa lời khuyên khi người dùng đã yêu cầu thực hiện. Hoàn tất phạm vi được giao và kiểm tra trước khi bàn giao.
- Không suy đoán trạng thái dự án từ hội thoại cũ. Đọc tiến độ và kiểm tra code/lệnh liên quan khi cần xác nhận.

## 2. Tài liệu cần đọc

| Tài liệu | Mục đích |
|---|---|
| [progress.md](progress.md) | Tiến độ thực tế, kết quả kiểm tra, điểm đang dừng |
| [docs/plan.md](docs/plan.md) | Lộ trình M1–M7 và tiêu chí từng mốc |
| [docs/business-rules.md](docs/business-rules.md) | Quy tắc nghiệp vụ, trạng thái, kho và tiền |
| [docs/architecture.md](docs/architecture.md) | Kiến trúc, quyền sở hữu module, API, dữ liệu và UI |
| [docs/acceptance-checklist.md](docs/acceptance-checklist.md) | Điều kiện nghiệm thu |
| [README.md](README.md) | Thiết lập, lệnh chạy, cấu hình môi trường |

Đọc phần liên quan đến công việc; không coi một tính năng có trong thiết kế là đã được triển khai.
Nếu code và đặc tả mâu thuẫn, xác định nguyên nhân trước khi sửa; không âm thầm thay đổi nghiệp vụ.

## 3. Quy trình bắt buộc theo từng giai đoạn

### Trước khi làm

Gửi kế hoạch ngắn trong chat, thường 4–6 dòng:

> - **Giai đoạn/phần:** Mx — tên phần đang làm.
> - **Mục tiêu:** người dùng sẽ làm được gì.
> - **Thay đổi:** chức năng và nhóm file/module chính sẽ thêm hoặc sửa.
> - **Kiểm tra:** cách chứng minh phần này hoạt động.
> - **Điểm dừng:** phần nào bàn giao để người dùng chạy thử.

- Bám phạm vi người dùng yêu cầu. Nếu giai đoạn lớn, chia thành phần có thể chạy thử và nói rõ ranh giới.
- Khi đã được yêu cầu triển khai, tự xử lý các lựa chọn kỹ thuật thông thường trong phạm vi đó; không hỏi lại quyền cho từng bước.
- Chỉ hỏi khi thiếu quyết định ảnh hưởng nghiệp vụ/phạm vi, thay đổi kiến trúc ngoài thiết kế, hoặc hành động vượt quyền đã được giao.
- Không tự mở rộng tính năng, đổi stack, nâng major dependency hoặc refactor phần không liên quan.

### Trong khi làm

- Đi theo từng lát cắt FE → API → DB khi phù hợp, tránh làm giao diện giả rồi báo tính năng hoàn chỉnh.
- Giữ thay đổi nhỏ, rõ trách nhiệm. Chẩn đoán nguyên nhân trước khi sửa lỗi; ưu tiên bản sửa tối thiểu.
- Nếu có vướng mắc hoặc đổi phạm vi đáng kể, báo ngắn: phát hiện gì, ảnh hưởng gì, sẽ xử lý thế nào.
- Không sửa hoặc xóa thay đổi của người dùng ngoài phạm vi nhiệm vụ. Kiểm tra Git trước các thao tác có thể ảnh hưởng chúng.

### Sau khi làm

1. Chạy các kiểm tra phù hợp; đọc kết quả thực tế trước khi kết luận.
2. Cập nhật `progress.md`: ngày, phần đã làm, lệnh/kết quả kiểm tra, giới hạn, việc còn lại và điểm dừng.
3. Cập nhật `docs/plan.md` khi tiêu chí mốc đã đạt hoặc lộ trình thay đổi; cập nhật README/hướng dẫn khi cách chạy thay đổi.
4. Bàn giao ngắn trong chat theo mẫu:

> - **Đã xong:** những thay đổi chính.
> - **Kiểm tra:** kết quả thật; mục chưa chạy phải ghi rõ.
> - **Key quan trọng:** 3–5 khái niệm/biến/luồng mới thực sự liên quan, mỗi key giải thích một câu về tác dụng và vị trí sử dụng. Nếu không có key mới, nói rõ.
> - **Chạy thử:** lệnh, URL, thao tác và kết quả mong đợi; dẫn tới hướng dẫn chi tiết nếu dài.
> - **Còn lại:** giới hạn và phần tiếp theo.

5. **Dừng để người dùng chạy thử. Không tự bắt đầu giai đoạn/phần tiếp theo.** Chỉ tiếp tục khi người dùng yêu cầu; không xem việc đã qua test là người dùng đã nghiệm thu.

## 4. Kiến trúc và chất lượng code

- Giữ stack hiện có: React/Vite/TypeScript strict/React Router/MUI/TanStack Query; NestJS/Prisma/PostgreSQL; npm workspaces và lockfile ở root.
- Phiên bản và lệnh lấy từ `package.json`/lockfile hiện hành. Không tự đổi Node toàn máy; Windows có `tools/npm.ps1` để dùng runtime local tương thích.
- Backend: Controller xử lý HTTP, DTO kiểm tra input runtime, Guard kiểm tra truy cập, Service giữ nghiệp vụ, Prisma thao tác dữ liệu. Không nhét nghiệp vụ vào controller hoặc frontend.
- Frontend: tách page/component/API theo feature; dữ liệu server dùng query cache, form dùng state cục bộ, filter chia sẻ được dùng URL. Không thêm lớp trừu tượng khi chưa có nhu cầu cụ thể.
- Không dùng `any`, ép kiểu mù hoặc tắt kiểm tra để che lỗi. API có kiểu rõ, xử lý lỗi an toàn và thông báo dễ hiểu.
- UI có loading, empty, error, success, chống gửi lặp; label và keyboard focus rõ, hoạt động trên mobile, không tràn ngang.
- Khi tới phần bán hàng: backend quyết định giá, phí, tổng, quyền sở hữu và chuyển trạng thái; không tin giá/quyền do client gửi.
- Thay đổi kho qua Inventory; thao tác kho/đơn/tiền liên quan dùng transaction phù hợp, kiểm soát đồng thời và idempotency. Không gọi email/upload/provider bên trong transaction DB.
- Thay đổi schema bằng migration có thể review. Không sửa migration đã áp dụng để làm lệch lịch sử database.

## 5. Bảo mật, dữ liệu và môi trường

- Ưu tiên local, dữ liệu giả và dịch vụ miễn phí theo yêu cầu hiện tại. Không tự tạo tài khoản dịch vụ, kích hoạt trả phí hoặc deploy khi chưa được giao.
- Giữ session server, cookie HttpOnly và CSRF theo thiết kế; kiểm tra role/owner ở backend. Không bỏ guard để chữa lỗi frontend/proxy.
- Không lưu mật khẩu/token dài hạn trong localStorage. Không ghi secret, cookie, token, mật khẩu hoặc dữ liệu cá nhân nhạy cảm vào Git, log, tài liệu hay chat.
- `.env` thật phải được bỏ qua; các `.env*.example` cần thiết phải được đưa vào repo, chỉ chứa placeholder/cấu hình demo an toàn. Không đưa secret vào biến `VITE_*`.
- Không tạo mật khẩu admin mặc định hoặc tự nâng quyền tài khoản. Dùng CLI tạo admin đã có khi được yêu cầu.
- Test tích hợp/E2E chỉ chạy với môi trường test và database riêng có hậu tố `_test`; kiểm tra trước mọi thao tác ghi hoặc cleanup. Chỉ dọn dữ liệu do test tạo.
- Không reset/truncate database, xóa volume, force push hoặc xóa dữ liệu người dùng nếu chưa được yêu cầu rõ. Trên Windows phải kiểm tra đường dẫn tuyệt đối trước thao tác xóa/di chuyển đệ quy.
- Khi được yêu cầu commit/push: kiểm tra diff, tệp bị ignore, tệp staged và remote; không đưa `.env`, mailbox, runtime, dependency hoặc artifact build vào commit. Không tự push khi chỉ được giao sửa code.

## 6. Kiểm chứng và định nghĩa hoàn thành

- Tính năng/nghiệp vụ hoặc bugfix quan trọng cần test hành vi thực: quan sát test bắt được lỗi trước sửa khi phù hợp, rồi xác nhận đạt sau sửa. Không viết test chỉ để soi cấu trúc implementation hoặc tăng số lượng.
- Thay đổi tài liệu nhỏ không cần chạy lại toàn bộ ứng dụng; kiểm tra nội dung, liên kết và diff. Với code, chọn unit/UI/integration/E2E theo rủi ro và chạy các kiểm tra bắt buộc của dự án.
- Các lệnh từ root trên Windows: `./tools/npm.ps1 run typecheck`, `./tools/npm.ps1 run build`, `./tools/npm.ps1 test`, `./tools/npm.ps1 run test:integration`, `./tools/npm.ps1 run test:e2e`. Điều kiện chạy xem README.
- Kiểm tra DB/transaction bằng PostgreSQL thật; kiểm tra luồng FE–API–cookie qua proxy khi thay đổi auth hoặc hành vi tích hợp.
- Không nói “đã pass/hoàn thành” khi chưa chạy hoặc chỉ dựa vào kết quả cũ. Phân biệt: đã viết, đã kiểm tra local, đã chạy CI, đã deploy và đã được người dùng nghiệm thu.
- Chỉ chốt phần bàn giao khi tiêu chí phạm vi đã được kiểm chứng, lỗi quan trọng đã xử lý, tài liệu được cập nhật và người dùng có cách chạy thử cụ thể. Nếu bị chặn, ghi đúng phần đã làm và nguyên nhân, không đánh dấu hoàn tất.

Trạng thái hiện tại luôn đọc từ `progress.md`; không chép cứng trạng thái một giai đoạn vào bộ quy tắc này.
