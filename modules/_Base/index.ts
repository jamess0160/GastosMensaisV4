import { Base_Cache_route } from "./routes/Cache/Cache.route";
import { Base_UserGroupNames_route } from "./routes/UserGroupNames/UserGroupNames.route";
import { Base_Companys_route } from "./routes/Companys/Companys.route";
import { Base_PasswordRecoverys_route } from "./routes/PasswordRecovery/PasswordRecovery.route";
import { Base_Plants_route } from "./routes/Plants/Plants.route";
import { Base_Users_route } from "./routes/Users/Users.route";
import { Base_SystemParams_route } from "./routes/SystemParams/SystemaParams.route";
import { Base_Utils_route } from "./routes/Utils/Utils.route";
import { Base_Permissions_route } from "./routes/Permissions/Permissions.route";

export const BaseModule = [
    Base_Cache_route,
    Base_Companys_route,
    Base_Plants_route,
    Base_UserGroupNames_route,
    Base_Users_route,
    Base_Utils_route,
    Base_PasswordRecoverys_route,
    Base_SystemParams_route,
    Base_Permissions_route
]