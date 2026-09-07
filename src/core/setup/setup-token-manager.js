import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
function hash(v){return createHash("sha256").update(String(v)).digest();}
export class SetupTokenManager {
  constructor({ttlMs=30*60*1000,maxAttempts=10}={}){this.ttlMs=ttlMs;this.maxAttempts=maxAttempts;this.reset();}
  reset(){this.plain=randomBytes(32).toString("base64url");this.digest=hash(this.plain);this.expiresAt=Date.now()+this.ttlMs;this.attempts=0;this.used=false;this.sessionDigest=null;return this.plain;}
  url(baseUrl){return `${String(baseUrl).replace(/\/$/,"")}/setup?token=${encodeURIComponent(this.plain)}`;}
  exchange(token){if(this.used||Date.now()>this.expiresAt||this.attempts>=this.maxAttempts)return null;this.attempts++;const d=hash(token);if(d.length!==this.digest.length||!timingSafeEqual(d,this.digest))return null;this.used=true;const session=randomBytes(32).toString("base64url");this.sessionDigest=hash(session);return session;}
  validateSession(session){if(!this.sessionDigest||Date.now()>this.expiresAt)return false;const d=hash(session);return d.length===this.sessionDigest.length&&timingSafeEqual(d,this.sessionDigest);}
  invalidate(){this.used=true;this.sessionDigest=null;this.plain="";}
}
