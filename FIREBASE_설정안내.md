# Firebase 연결 안내 (선생님용, 약 10분)

Firebase는 7팀 기기와 선생님 화면을 **실시간으로 이어 주는 무료 저장소**예요.
아래 순서대로 누르기만 하면 돼요. 무료 요금제(Spark)로 충분해요. 카드 등록은 필요 없어요.

> 💡 화면 글자가 영어로 나오면, 괄호 안의 영어 이름을 찾으세요.

---

## 1. 프로젝트 만들기
1. 크롬에서 **https://console.firebase.google.com** 에 들어가 구글 계정으로 로그인해요.
2. 가운데 큰 카드 **「Firebase 프로젝트 만들기」(Create a Firebase project)** 를 눌러요.
3. 프로젝트 이름: `earth-case-file` (아무 이름이나 괜찮아요) → **계속**
4. **Google 애널리틱스**는 필요 없어요. 스위치를 **꺼요** → **프로젝트 만들기**
5. 잠시 뒤 **계속**을 누르면 프로젝트 첫 화면(프로젝트 개요)이 나와요.

## 2. 실시간 데이터베이스 만들기
1. **Realtime Database** 화면을 열어요. 아래 셋 중 편한 방법으로 하세요.
   - **방법 A (메뉴):** 왼쪽 메뉴의 **「데이터베이스 및 스토리지」(Databases & Storage)** → **「Realtime Database」**
     - 예전 안내에 나오는 「빌드(Build)」 메뉴는 이제 없어요.
     - 왼쪽 메뉴가 아이콘만 보이면 맨 아래 **»** (또는 맨 위 ≡)를 눌러 펼쳐요.
   - **방법 B (검색):** 화면 맨 위 **검색창**(돋보기)에 `Realtime` 이라고 쓰고 나오는 **Realtime Database** 를 눌러요.
   - **방법 C (바로 가기):** 주소창에 `https://console.firebase.google.com/project/_/database` 를 넣고 프로젝트를 골라요.
   - ⚠️ 비슷한 이름의 「Firestore Database」가 아니에요. 꼭 **Realtime Database**!
2. **「데이터베이스 만들기」(Create Database)** 를 눌러요.
3. 위치: **싱가포르 (asia-southeast1)** 를 고르고 → **다음**
   - 우리나라에서 가장 가까워서 빨라요.
4. **「잠금 모드로 시작」(Start in locked mode)** 을 고르고 → **사용 설정**

## 3. 보안 규칙 붙여 넣기 (중요!)
1. Realtime Database 화면 위쪽 탭 중 **「규칙」(Rules)** 을 눌러요.
2. 이 폴더의 **`database.rules.json`** 파일을 메모장으로 열어 **전부 복사**해요. (Ctrl+A → Ctrl+C)
3. 규칙 입력 칸의 내용을 **전부 지우고** 붙여 넣어요. (Ctrl+A → Ctrl+V)
4. 위쪽 파란 **「게시」(Publish)** 버튼을 눌러요.
   - 빨간 오류가 나면 그 줄을 화면 캡처해서 보여 주세요.

> 이 규칙은 `rooms/4자리 수업 코드` 자리에만, 정해진 모양의 데이터만 쓸 수 있게 막아 줘요.
> 글자 수도 제한해서 장난 글이 길게 올라오지 못해요.

## 4. 익명 로그인 켜기
학생에게는 **아무 로그인 화면도 뜨지 않아요.** 앱을 거치지 않고 데이터베이스를 직접 건드리는 것을 막기 위한 장치예요.
1. **Authentication** 화면을 열어요.
   - 메뉴: 왼쪽 **「보안」(Security)** → **「Authentication」**
   - 또는 맨 위 검색창에 `Authentication`
   - 또는 주소창에 `https://console.firebase.google.com/project/_/authentication/providers`
   - 처음이면 **시작하기**(Get started)를 눌러요.
2. **「로그인 방법」(Sign-in method)** 탭 → 목록에서 **「익명」(Anonymous)** 을 눌러요.
3. **사용 설정** 스위치를 켜고 → **저장**

## 5. 웹 앱 등록하고 설정값 복사하기
1. 왼쪽 맨 위 **「프로젝트 개요」(Project Overview)** 옆 ⚙️ 톱니바퀴 → **「프로젝트 설정」(Project settings)**
2. **「일반」(General)** 탭을 아래로 내리면 **「내 앱」(Your apps)** 이 있어요. **`</>`** (웹) 아이콘을 눌러요.
3. 앱 닉네임: `earth-case-web` → **「Firebase 호스팅도 설정」은 체크하지 않아요** → **앱 등록**
4. 화면에 이런 코드가 나와요. **`{` 부터 `}` 까지만** 복사해요.
   ```js
   const firebaseConfig = {
     apiKey: "AIza....",
     authDomain: "....firebaseapp.com",
     databaseURL: "https://....firebasedatabase.app",
     projectId: "....",
     ...
   };
   ```
   - ⚠️ **`databaseURL` 줄이 있는지 꼭 보세요.** 없으면 2번에서 만든 Realtime Database 화면 위쪽의
     `https://....firebasedatabase.app` 주소를 복사해 `databaseURL: "그 주소",` 한 줄을 직접 넣어요.

## 6. 앱에 넣기
- **쉬운 방법:** 복사한 `{ ... }` 를 Claude 대화창에 붙여 주세요. 제가 넣고 연결 시험까지 할게요.
  (이 값들은 **공개되어도 되는 값**이에요. 비밀번호나 비밀 키가 아니에요.)
- **직접 하는 방법:** `js/config.js` 를 메모장으로 열어 `firebaseConfig: null,` 의 `null` 자리에 붙여 넣고 저장해요.

## 7. 잘 연결됐는지 확인
1. `로컬에서_열기.bat` 를 더블클릭해요.
2. 교사 화면 위쪽 오른쪽에 **초록색 「실시간」** 표시가 보이면 성공! 🎉
   - 노란색 「데모 모드」가 보이면 `config.js` 가 아직 비어 있는 거예요.
   - 「실시간 연결에 실패했어요」 창이 뜨면 4번(익명 로그인)을 켰는지 확인해요.
3. 휴대폰이나 다른 노트북으로 학생 화면을 열어 같은 수업 코드로 들어가 보세요. 핀이 2초 안에 교사 지도에 나타나면 완성!

---

## 나중에 (6단계 배포 때) 할 일
- **Authentication → 설정(Settings) → 승인된 도메인(Authorized domains)** 에 `lkb747-del.github.io` 를 추가해요.
  (안 하면 인터넷 주소에서 익명 로그인이 막혀요. 내 컴퓨터 `localhost`는 처음부터 허용돼 있어요.)

## 수업이 끝나면
- 교사 화면 ⚙️ → **💾 결과 내보내기** → **🗑️ 수업 끝 · 방 데이터 지우기**
- 학생 이름이나 사진은 처음부터 저장하지 않아요. 팀 이름과 고른 문장만 저장돼요.
