import { Accounts_route } from "./Accounts/Accounts.route";
import { BudgetPeriods_route } from "./BudgetPeriods/BudgetPeriods.route";
import { Budgets_route } from "./Budgets/Budgets.route";
import { Categories_route } from "./Categories/Categories.route";
import { PaymentMethods_route } from "./PaymentMethods/PaymentMethods.route";
import { ExpensePayments_route } from "./ExpensePayments/ExpensePayments.route";
import { Expenses_route } from "./Expenses/Expenses.route";
import { Inflows_route } from "./Inflows/Inflows.route";
import { Persons_route } from "./Persons/Persons.route";
import { Tags_route } from "./Tags/Tags.route";
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
    Categories_route,
    Persons_route,
    Tags_route,
    Inflows_route,
    Expenses_route,
    ExpensePayments_route,
    Budgets_route,
    BudgetPeriods_route,
    Base_Utils_route,
]
