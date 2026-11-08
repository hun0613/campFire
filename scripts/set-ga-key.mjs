// 구글 서비스 계정 키(JSON)를 .env 에 넣는다. 키 내용은 화면에 출력하지 않는다
// 사용법: node scripts/set-ga-key.mjs <키 파일 경로> [GA4 속성 ID]
//   예)   node scripts/set-ga-key.mjs ~/Downloads/campfire-analytics-1234.json 512345678
// - .env 의 GA_SA_KEY(base64), GA_PROPERTY_ID 를 채우거나 바꾼다
// - macOS 에서는 GA_SA_KEY 값을 클립보드에도 복사한다 → Render 환경 변수에 그대로 붙여 넣기
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const [file, propertyId] = process.argv.slice(2);
if (!file) { console.error('키 파일 경로를 넣어 주세요. 예) node scripts/set-ga-key.mjs ~/Downloads/키파일.json 512345678'); process.exit(1); }
const json = JSON.parse(fs.readFileSync(file.replace(/^~/, process.env.HOME), 'utf8'));
if (json.type !== 'service_account' || !json.private_key || !json.client_email) { console.error('서비스 계정 키 파일이 아니에요.'); process.exit(1); }
if (propertyId && !/^\d{6,}$/.test(propertyId)) { console.error('GA4 속성 ID는 숫자예요. (G-로 시작하는 측정 ID가 아니에요)'); process.exit(1); }

const b64 = Buffer.from(JSON.stringify(json)).toString('base64');
const envPath = path.resolve(import.meta.dirname, '..', '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const set = (k, v) => {
  const re = new RegExp(`^${k}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, `${k}=${v}`) : `${env.replace(/\n?$/, '\n')}${k}=${v}\n`;
};
set('GA_SA_KEY', b64);
if (propertyId) set('GA_PROPERTY_ID', propertyId);
fs.writeFileSync(envPath, env);

let copied = false;
try { execSync('pbcopy', { input: b64 }); copied = true; } catch { /* macOS 가 아니면 건너뜀 */ }
console.log('✅ .env 에 GA_SA_KEY 를 넣었어요' + (propertyId ? ` (GA_PROPERTY_ID=${propertyId})` : ''));
console.log(`   서비스 계정 이메일: ${json.client_email}`);
console.log('   → 이 이메일을 GA4 관리 > 속성 액세스 관리에 「뷰어」로 추가하세요.');
if (copied) console.log('📋 GA_SA_KEY 값을 클립보드에 복사했어요. Render Environment 에 GA_SA_KEY 로 붙여 넣으세요.');
