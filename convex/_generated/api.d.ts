/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as clerk from "../clerk.js";
import type * as clockSessions from "../clockSessions.js";
import type * as dashboard from "../dashboard.js";
import type * as hours from "../hours.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as settings from "../settings.js";
import type * as studentInfo from "../studentInfo.js";
import type * as teamMembers from "../teamMembers.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  clerk: typeof clerk;
  clockSessions: typeof clockSessions;
  dashboard: typeof dashboard;
  hours: typeof hours;
  http: typeof http;
  migrations: typeof migrations;
  settings: typeof settings;
  studentInfo: typeof studentInfo;
  teamMembers: typeof teamMembers;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
