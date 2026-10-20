/** Внутрішній DTO без валідації: UsersService отримує вже готовий хеш і про паролі не знає. */
export class CreateUserDto {
  email: string;
  passwordHash: string;
}
