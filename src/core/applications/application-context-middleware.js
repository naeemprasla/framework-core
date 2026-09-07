import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";
const ID=/^app_[A-Za-z0-9_-]{8,128}$/;
export function createApplicationContextMiddleware({applications,appConfig=null}){
  return async function applicationContext(req,_res,next){
    try{
      if(req.path.startsWith('/admin')||req.path.startsWith('/health')||req.path.startsWith('/setup'))return next();
      const appId=String(req.get('x-application-id')||'').trim();
      if(!appId)return next();
      if(!ID.test(appId))throw new AppError({code:ErrorCodes.VALIDATION_FAILED,message:'Invalid application identifier',status:400});
      const app=await applications.findById(appId);if(!app||app.status!=='ACTIVE')throw new AppError({code:ErrorCodes.NOT_FOUND,message:'Application not found',status:404});
      if(app.api_enabled===false)throw new AppError({code:ErrorCodes.FORBIDDEN,message:'Application API is disabled',status:403});
      req.context.appId=app.app_id;req.context.application=app;
      const auth=String(req.get('authorization')||'');
      if(appConfig && auth.startsWith('Bearer fwa_')){const credential=await appConfig.authenticateApiKey(app.app_id,auth.slice(7));if(!credential)throw new AppError({code:ErrorCodes.UNAUTHORIZED,message:'Invalid API credential',status:401});req.context.apiCredential=credential;req.context.identity={authority_domain:'service',credential_id:credential.credential_id,app_id:app.app_id,scopes:credential.scopes??[]};}
      next();
    }catch(e){next(e);}
  };
}
