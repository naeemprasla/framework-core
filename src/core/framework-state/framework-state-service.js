import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";
export class FrameworkStateService {
  constructor(repository) { this.repository = repository; }
  async getStatus() {
    const state = await this.repository.get();
    if (!state) return { installation_status:"UNINITIALIZED", initialized:false };
    return { ...state, initialized:state.installation_status === "INITIALIZED" };
  }
  async assertSetupAllowed() {
    const state = await this.getStatus();
    if (state.installation_status !== "SETUP_REQUIRED") throw new AppError({ code:ErrorCodes.SETUP_LOCKED, message:"Initial setup is no longer available", status:404 });
    return state;
  }
  async completeInitialSetup(frameworkVersion) { return this.repository.completeInitialSetup({ frameworkVersion }); }
}
