import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buf) {
  let bits = ""; for (const byte of buf) bits += byte.toString(2).padStart(8,"0");
  let out = ""; for (let i=0;i<bits.length;i+=5) out += ALPHABET[parseInt(bits.slice(i,i+5).padEnd(5,"0"),2)];
  return out;
}
function base32Decode(value) {
  const clean = String(value).replace(/=+$/g,"").replace(/\s+/g,"").toUpperCase();
  let bits=""; for (const c of clean) { const n=ALPHABET.indexOf(c); if(n<0) throw new Error("Invalid base32"); bits += n.toString(2).padStart(5,"0"); }
  const bytes=[]; for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2)); return Buffer.from(bytes);
}
function hotp(secret,counter,digits=6){
  const b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter)); const h=createHmac("sha1",base32Decode(secret)).update(b).digest(); const o=h[h.length-1]&15; const n=(h.readUInt32BE(o)&0x7fffffff)%10**digits; return String(n).padStart(digits,"0");
}
export class TotpService {
  generateSecret(bytes=20){ return base32Encode(randomBytes(bytes)); }
  uri({ secret, account, issuer="Framework" }) { return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`; }
  verify({ secret, code, now=Date.now(), window=1 }) {
    const input=String(code??"").replace(/\s/g,""); if(!/^\d{6}$/.test(input)) return false; const counter=Math.floor(now/30000);
    for(let d=-window;d<=window;d++){ const candidate=hotp(secret,counter+d); const a=Buffer.from(candidate), b=Buffer.from(input); if(a.length===b.length&&timingSafeEqual(a,b)) return true; }
    return false;
  }
}
