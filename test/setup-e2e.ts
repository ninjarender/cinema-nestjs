import 'dotenv/config';

// e2e працює з окремою базою, щоб не чіпати дані розробки.
// Підміна має відбутися ДО імпорту AppModule: ConfigModule.forRoot читає й валідує
// змінні під час імпорту, а import у spec-файлі підіймається вище за будь-який код.
// ConfigModule не перезаписує змінні, які вже є в process.env.
process.env.POSTGRES_DB = `${process.env.POSTGRES_DB}_test`;
