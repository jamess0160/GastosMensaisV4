import { Accounts_route } from "./Accounts/Accounts.route";
import { PaymentMethods_route } from "./PaymentMethods/PaymentMethods.route";
import { Base_Cache_route } from "./Cache/Cache.route";
import { Users_route } from "./Users/Users.route";
import { UsersAuth_route } from "./UsersAuth/UsersAuth.route";
import { Base_Utils_route } from "./Utils/Utils.route";
import { Workspaces_route } from "./Workspaces/Workspaces.route";

export const Routes = [
    Base_Cache_route,
    Users_route,
    UsersAuth_route,
    Workspaces_route,
    Accounts_route,
    PaymentMethods_route,
    Base_Utils_route,
]
