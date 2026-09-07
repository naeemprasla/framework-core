import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function decodeBase64UrlStrict(value, expectedLength, label) {
  const input=String(value??"");
  if(!/^[A-Za-z0-9_-]+$/.test(input)) throw new Error(`Invalid ${label}`);
  const buf=Buffer.from(input,"base64url");
  if(buf.length!==expectedLength || buf.toString("base64url")!==input) throw new Error(`Invalid ${label}`);
  return buf;
}

export class SecretBox {
  constructor(key){ if(!Buffer.isBuffer(key)||key.length!==32) throw new TypeError("SecretBox requires a 32-byte key"); this.key=Buffer.from(key); }
  encrypt(value){ const iv=randomBytes(12); const c=createCipheriv("aes-256-gcm",this.key,iv); const data=Buffer.concat([c.update(String(value),"utf8"),c.final()]); return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${data.toString("base64url")}`; }
  decrypt(encoded){
    const parts=String(encoded??"").split(".");
    if(parts.length!==4||parts[0]!=="v1") throw new Error("Unsupported encrypted secret");
    const iv=decodeBase64UrlStrict(parts[1],12,"secret IV");
    const tag=decodeBase64UrlStrict(parts[2],16,"secret authentication tag");
    if(!/^[A-Za-z0-9_-]*$/.test(parts[3])) throw new Error("Invalid encrypted secret payload");
    const data=Buffer.from(parts[3],"base64url");
    if(data.toString("base64url")!==parts[3]) throw new Error("Invalid encrypted secret payload");
    const d=createDecipheriv("aes-256-gcm",this.key,iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(data),d.final()]).toString("utf8");
  }
}
