export type UserRole =
  | "user"
  | "agency_owner"
  | "agency_admin"
  | "agency_agent"
  | "admin"
  | "super_admin";

  export type UserGender =
  | "Male"
  | "Female"
  | "Other"



export interface AuthenicatedUser {
    id: String;
    email?:String;
    role: UserRole;
    gender: UserGender;
    username: String;
    phoneNumber?: String;
}


