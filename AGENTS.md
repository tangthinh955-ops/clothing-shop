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

### Chia nhỏ để người dùng kiểm soát và chạy thử

- Mỗi mốc lớn phải chia thành các phần có mã `Mx.1`, `Mx.2`, `Mx.3`... trước khi triển khai, ví dụ `M3.1`. Không gom toàn bộ M3 thành một lần code rồi mới bàn giao.
- Gửi bảng chia phần với các cột: mã phần, thay đổi người dùng thấy được, phạm vi chính, cách chạy thử/kết quả mong đợi và phụ thuộc. Bảng tổng quan chỉ là lộ trình; duyệt lộ trình không tự cho phép code mọi phần liên tiếp.
- Mỗi phần chỉ tập trung một thay đổi hoặc một luồng nhỏ có thể kiểm chứng ngay. Ưu tiên lát cắt FE–API–DB đủ để người dùng thao tác thật; nếu bắt buộc làm nền tảng riêng, nêu cách kiểm tra cụ thể và giới hạn chưa có UI, không báo tính năng đã dùng được.
- Nếu phần vẫn gồm nhiều luồng hoặc cần quá nhiều thao tác để thử, tiếp tục tách thành `Mx.1.1`, `Mx.1.2`...; không chia theo số file hoặc tạo bước chỉ có giao diện giả.
- Trước mỗi phần, gửi kế hoạch chi tiết của riêng phần đó trong chat và chờ duyệt theo mục dưới. Chỉ code phần đã được duyệt; không tranh thủ triển khai phần tiếp theo.
- Sau mỗi phần, chạy kiểm tra phù hợp, ghi tiến độ theo mã phần, hướng dẫn người dùng thử đúng thay đổi vừa làm rồi dừng. Phân biệt rõ: đã viết, agent đã kiểm tra, chờ người dùng thử và người dùng đã xác nhận.
- Chỉ chuyển phần tiếp theo khi người dùng đã phản hồi và yêu cầu tiếp tục; vẫn gửi kế hoạch phần tiếp theo để duyệt nếu chưa được duyệt cụ thể. Nếu có lỗi trong phần vừa bàn giao, xử lý trong phạm vi đó trước khi chuyển phần.

### Trước khi làm

Trước mỗi nhiệm vụ/phần code, gửi bảng kế hoạch ngắn ngay trong chat để người dùng xem và duyệt:

| Nội dung | Kế hoạch |
|---|---|
| Giai đoạn/phần | Mx.y — tên phần nhỏ đang làm |
| Mục tiêu | Người dùng sẽ làm được gì |
| Thay đổi | Chức năng nhỏ sẽ triển khai |
| File dự kiến | Đường dẫn từng file sẽ thêm/sửa/xóa hoặc di chuyển; mỗi file ghi ngắn thay đổi gì và vì sao |
| Data flow | 1–3 câu mô tả dữ liệu đầu vào, nơi xử lý/lưu và kết quả trả về giao diện của phần này |
| Kiểm tra | Cách chứng minh phần này hoạt động |
| Điểm dừng | Phần bàn giao để người dùng chạy thử |

- Danh sách file dùng đường dẫn cụ thể của phần đang làm, gồm cả test, migration và tài liệu nếu có; không chỉ ghi chung tên module. File mới chưa chốt tên phải ghi rõ là dự kiến.
- Data flow bám thao tác cụ thể: người dùng nhập/bấm gì → frontend gửi dữ liệu tới API nào → backend kiểm tra/xử lý gì → đọc/ghi dữ liệu nào → trả kết quả và cập nhật UI ra sao. Nêu tên file/hàm chính khi giúp lần theo code; phần không đi qua FE/API/DB thì mô tả luồng thực tế, không thêm bước giả. Giải thích ngắn, không lặp lại định nghĩa module/service/controller đã biết.
- **Sau khi gửi bảng kế hoạch, dừng lượt và chờ người dùng duyệt rồi mới code.** Không gửi kế hoạch rồi tự triển khai ngay; không coi im lặng là đồng ý. Nếu người dùng đã duyệt rõ kế hoạch cụ thể trong hội thoại thì triển khai đúng phạm vi đó, không yêu cầu duyệt lại.
- Trước khi duyệt, chỉ đọc/khảo sát cần thiết để lập kế hoạch; không sửa code, cài dependency hoặc chạy migration. File kế hoạch và hướng dẫn chạy thử không thay thế việc gửi bảng kế hoạch trong chat trước khi code.

- Bám phạm vi người dùng yêu cầu. Nếu giai đoạn lớn, chia thành phần có thể chạy thử và nói rõ ranh giới.
- Sau khi kế hoạch được duyệt, tự xử lý các lựa chọn kỹ thuật thông thường trong phạm vi đó; không hỏi lại quyền cho từng bước.
- Ngoài bước duyệt kế hoạch trước khi code, chỉ hỏi khi thiếu quyết định ảnh hưởng nghiệp vụ/phạm vi, thay đổi kiến trúc ngoài thiết kế, hoặc hành động vượt quyền đã được giao. Nếu cần mở rộng phạm vi đã duyệt, gửi kế hoạch điều chỉnh và chờ duyệt trước khi làm phần mở rộng.
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
> - **File đã đổi:** đường dẫn các file thực tế thêm/sửa/xóa hoặc di chuyển trong phần này, mỗi file giải thích một câu; nêu khác biệt với dự kiến nếu có, không nhận các thay đổi có sẵn là do mình làm.
> - **Data flow:** 1–3 câu tóm tắt luồng thực tế sau thay đổi, từ thao tác/đầu vào đến xử lý, lưu và hiển thị kết quả; tập trung phần mới.
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

### Clean code — tách trách nhiệm, tránh gom file

- Mỗi file tập trung một trách nhiệm rõ ràng; tên file/hàm/biến mô tả đúng mục đích. Tách khi một file chứa nhiều phần thay đổi vì các lý do khác nhau, không đợi file dài mới xem xét. Không tách mọi hàm nhỏ thành file riêng hoặc thêm tầng trừu tượng khi chưa có nhu cầu.
- Backend: `*.module.ts` chỉ khai báo và kết nối imports/controllers/providers/exports; không định nghĩa Controller, Service hoặc DTO trong file module. Controller nhận HTTP, gọi Service và trả response; nghiệp vụ, truy vấn Prisma và transaction nằm trong Service; DTO và Guard giữ trách nhiệm riêng.
- Frontend: `App.tsx` tập trung ghép layout và route; nội dung trang nằm trong page của feature tương ứng. Khi route nhiều hoặc khó đọc, tách cấu hình route/thành phần bảo vệ route; không chỉ chuyển nguyên file đang nhiều trách nhiệm sang file khác.
- Frontend: endpoint và hàm gọi API đặt trong `api/` của feature; page/hook gọi qua API đó. HTTP, cookie, CSRF và chuyển đổi lỗi dùng chung ở `shared/api`; không rải `fetch` hoặc endpoint trong component/page. Tách component/hook khi có trách nhiệm riêng hoặc logic cần tái sử dụng; không bắt buộc mọi page nhỏ phải có hook riêng.
- Viết code dễ đọc: không nén nhiều câu lệnh, hàm hoặc khối JSX phức tạp vào một dòng. File khoảng trên 300 dòng cần đánh giá tách theo trách nhiệm, không coi số dòng là giới hạn cứng hoặc nén dòng để né đánh giá.
- Trước bàn giao, rà các file đã thêm/sửa về trách nhiệm, vị trí, phụ thuộc và phần logic lặp. Test/typecheck/build đạt không thay thế review cấu trúc. Chỉ điều chỉnh trong phạm vi được duyệt; nếu cần refactor ngoài phạm vi, nêu rõ và chờ duyệt kế hoạch riêng.

## 5. Bảo mật, dữ liệu và môi trường

- Đây là website bán hàng thật của shop (từ 29/10/2026), không phải demo. Phát triển và test trên local/`_test` với dữ liệu thử; dữ liệu khách thật chỉ nằm trên production. Không tự tạo tài khoản dịch vụ, thuê VPS, mua domain, kích hoạt trả phí hoặc deploy khi chưa được giao.
- Không truy cập, sao chép hoặc chỉnh dữ liệu production (DB, ảnh, backup) nếu chưa được yêu cầu rõ; không đưa dữ liệu khách thật (tên, SĐT, địa chỉ, email) vào local, test, log, tài liệu hay chat. Lệnh tạo dữ liệu mẫu như `seed:demo` không được chạy trên production.
- Giữ session server, cookie HttpOnly và CSRF theo thiết kế; kiểm tra role/owner ở backend. Không bỏ guard để chữa lỗi frontend/proxy.
- Không lưu mật khẩu/token dài hạn trong localStorage. Không ghi secret, cookie, token, mật khẩu hoặc dữ liệu cá nhân nhạy cảm vào Git, log, tài liệu hay chat.
- `.env` thật phải được bỏ qua; các `.env*.example` cần thiết phải được đưa vào repo, chỉ chứa placeholder/cấu hình mẫu an toàn. Không đưa secret vào biến `VITE_*`.
- Không tạo mật khẩu admin mặc định hoặc tự nâng quyền tài khoản. Dùng CLI tạo admin đã có khi được yêu cầu.
- Test tích hợp/E2E chỉ chạy với môi trường test và database riêng có hậu tố `_test`; kiểm tra trước mọi thao tác ghi hoặc cleanup. Chỉ dọn dữ liệu do test tạo.
- Không reset/truncate database, xóa volume, force push hoặc xóa dữ liệu người dùng nếu chưa được yêu cầu rõ. Trên Windows phải kiểm tra đường dẫn tuyệt đối trước thao tác xóa/di chuyển đệ quy.
- Khi được yêu cầu commit/push: kiểm tra diff, tệp bị ignore, tệp staged và remote; không đưa `.env`, mailbox, runtime, dependency hoặc artifact build vào commit. Không tự push khi chỉ được giao sửa code.
- Commit message và mô tả PR không thêm dòng ghi công AI (ví dụ `Co-Authored-By: Claude ...`, "Generated with Claude Code") để agent không xuất hiện trong Contributors; tác giả commit là người dùng.

## 6. Kiểm chứng và định nghĩa hoàn thành

- Tính năng/nghiệp vụ hoặc bugfix quan trọng cần test hành vi thực: quan sát test bắt được lỗi trước sửa khi phù hợp, rồi xác nhận đạt sau sửa. Không viết test chỉ để soi cấu trúc implementation hoặc tăng số lượng.
- Thay đổi tài liệu nhỏ không cần chạy lại toàn bộ ứng dụng; kiểm tra nội dung, liên kết và diff. Với code, chọn unit/UI/integration/E2E theo rủi ro và chạy các kiểm tra bắt buộc của dự án.
- Các lệnh từ root trên Windows: `./tools/npm.ps1 run typecheck`, `./tools/npm.ps1 run build`, `./tools/npm.ps1 test`, `./tools/npm.ps1 run test:integration`, `./tools/npm.ps1 run test:e2e`. Điều kiện chạy xem README.
- Kiểm tra DB/transaction bằng PostgreSQL thật; kiểm tra luồng FE–API–cookie qua proxy khi thay đổi auth hoặc hành vi tích hợp.
- Không nói “đã pass/hoàn thành” khi chưa chạy hoặc chỉ dựa vào kết quả cũ. Phân biệt: đã viết, đã kiểm tra local, đã chạy CI, đã deploy và đã được người dùng nghiệm thu.
- Chỉ chốt phần bàn giao khi tiêu chí phạm vi đã được kiểm chứng, lỗi quan trọng đã xử lý, tài liệu được cập nhật và người dùng có cách chạy thử cụ thể. Nếu bị chặn, ghi đúng phần đã làm và nguyên nhân, không đánh dấu hoàn tất.

Trạng thái hiện tại luôn đọc từ `progress.md`; không chép cứng trạng thái một giai đoạn vào bộ quy tắc này.
