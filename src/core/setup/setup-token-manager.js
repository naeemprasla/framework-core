import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
const hash=value=>createHash("sha256").update(value).digest();
export class SetupTokenManager {
  constructor({ttlMs=30*60*1000}={}){this.ttlMs=ttlMs;this.plain=randomBytes(32).toString("base64url");this.digest=hash(this.plain);this.expiresAt=Date.now()+ttlMs;this.exchanged=false;this.sessionDigest=null;}
  url(baseUrl){return `${String(baseUrl).replace(/\/$/,"")}/setup/?token=${encodeURIComponent(this.plain)}`;}
  exchange(token){if(this.exchanged||Date.now()>this.expiresAt||typeof token!=="string")return null;const d=hash(token);if(d.length!==this.digest.length||!timingSafeEqual(d,this.digest))return null;this.exchanged=true;this.plain="";const session=randomBytes(32).toString("base64url");this.sessionDigest=hash(session);return session;}
  validateSession(session){if(!this.exchanged||!this.sessionDigest||Date.now()>this.expiresAt||typeof session!=="string")return false;const d=hash(session);return d.length===this.sessionDigest.length&&timingSafeEqual(d,this.sessionDigest);}
  invalidate(){this.expiresAt=0;this.sessionDigest=null;this.exchanged=true;this.plain="";}
}
