// ⚙️ 선생님이 직접 고치는 설정 파일입니다.
// ⚠️ 여기에는 AI 키나 비밀 키를 절대 넣지 마세요. (이 앱에는 필요 없습니다)

export const CONFIG = {
  // 교사 화면(/teacher) 비밀번호. 학생이 실수로 들어오지 않게 하는 정도의 잠금입니다.
  teacherPassword: '2026',

  // Firebase 웹 설정값. null이면 '데모 모드'(한 기기 안에서만 동작)로 열립니다.
  // 채우는 방법: FIREBASE_설정안내.md 의 5번을 보세요.
  // Firebase 콘솔에서 복사한 { ... } 부분을 null 자리에 그대로 붙여 넣고, 맨 끝에 쉼표(,)를 남겨 두세요.
  // Firebase 웹 설정값은 공개되어도 되는 값입니다. 대신 database.rules.json 보안 규칙을 꼭 적용하세요.
  firebaseConfig: {
    apiKey: "AIzaSyCWrvlqW4M5M8XwpxoNQlA19Ke1OxaJdlw",
    authDomain: "earth-case-file-b9ab1.firebaseapp.com",
    databaseURL: "https://earth-case-file-b9ab1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "earth-case-file-b9ab1",
    storageBucket: "earth-case-file-b9ab1.firebasestorage.app",
    messagingSenderId: "88137294788",
    appId: "1:88137294788:web:fd23d30dae483108beba91",
  },
  // 붙여 넣은 모습 예시)
  // firebaseConfig: {
  //   apiKey: "AIza....",
  //   authDomain: "earth-case-file.firebaseapp.com",
  //   databaseURL: "https://earth-case-file-default-rtdb.asia-southeast1.firebasedatabase.app",
  //   projectId: "earth-case-file",
  //   storageBucket: "earth-case-file.appspot.com",
  //   messagingSenderId: "1234567890",
  //   appId: "1:1234567890:web:abcdef"
  // },

  // 연결의 실 공동 목표
  linkGoal: 10,

  // 지도 투어 한 팀당 발표 시간(초)
  tourSeconds: 40,
};
