# Template generator (tools/generate-from-git.js)

간단한 템플릿 생성 도구입니다. 깃에서 템플릿을 클론한 뒤, 지정한 치환맵에 따라 텍스트 치환을 수행하고(주로 package.json, app.json, README 등), 필요하면 `npm install`까지 실행합니다.

주의: 이 스크립트는 단순 텍스트 치환만 수행합니다. 코드 구조를 재작성하거나 시크릿을 주입하는 작업에는 사용하지 마세요.

Usage (PowerShell):

```powershell
# 1) 간단 실행 (npm install 포함):
node .\tools\generate-from-git.js https://github.com/owner/repo.git my-app .\replacements.json

# 2) 설치 건너뛰기:
node .\tools\generate-from-git.js https://github.com/owner/repo.git my-app .\replacements.json --no-install

# replacements.json 예시
# {
#   "TEMPLATE_APP_NAME": "My App",
#   "TEMPLATE_AUTHOR": "Kim" 
# }
```

제한 및 요구 사항
- 로컬에 `git`와 `npm`이 설치되어 있어야 합니다.
- 치환은 `.json`, `.md`, `.tsx`, `.ts`, `.js`, `.jsx`, `.env`, `.txt` 파일에서 수행됩니다.
- 목적: 템플릿 클론 → 간단한 치환 → (선택) 의존성 설치 까지 자동화.

안전 팁
- 신뢰할 수 없는 외부 리포지토리는 신중하게 사용하세요. 스크립트는 클론한 코드의 설치/빌드를 자동으로 실행할 수 있습니다.
 
GitHub 템플릿 사용 권장 설정
- 리포지토리 Settings → "Template repository" 체크: 사용자가 GitHub UI에서 "Use this template"로 바로 복제할 수 있습니다.
- README에 `template.metadata.json`의 placeholder 설명을 포함하세요(레이블/기본값/설명).
- `.gitignore`, `LICENSE` 등 기본 파일을 포함하면 사용성 향상.

보안/운영 팁
- 서버에서 자동 `npm install`·빌드를 수행할 때는 샌드박스 실행 및 postinstall 스크립트 검증을 권장합니다.
- 템플릿에 시크릿(토큰/키)을 직접 포함하지 마세요.

Mustache 토큰 지원
- 이 도구는 `TEMPLATE_KEY` 같은 리터럴 키뿐 아니라 `{{KEY}}` 형태의 mustache 토큰도 치환합니다.
- 템플릿 작성 시 일관된 토큰 스타일을 사용하세요 (권장: `{{TEMPLATE_APP_NAME}}` 혹은 `TEMPLATE_APP_NAME`).

