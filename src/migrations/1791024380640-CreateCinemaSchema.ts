import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCinemaSchema1791024380640 implements MigrationInterface {
  name = 'CreateCinemaSchema1791024380640';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "showing_id" uuid NOT NULL, "total_price" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "films" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying(255) NOT NULL, "duration_minutes" integer NOT NULL, "release_year" integer NOT NULL, CONSTRAINT "PK_697487ada088902377482c970d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "halls" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(100) NOT NULL, "rows" integer NOT NULL, "seats_per_row" integer NOT NULL, CONSTRAINT "UQ_46711ac8c7003abe9f974263bfb" UNIQUE ("name"), CONSTRAINT "PK_4665c2f3b1e718e12b06278bae8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "showings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "film_id" uuid NOT NULL, "hall_id" uuid NOT NULL, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "price" integer NOT NULL, CONSTRAINT "PK_b9b94e86f112c69c3012959cd51" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "booking_seats" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "booking_id" uuid NOT NULL, "showing_id" uuid NOT NULL, "row" integer NOT NULL, "seat" integer NOT NULL, CONSTRAINT "PK_a4d929dea33a0153ba9bc253db1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c752dcc1749f6a2c89819b50b5" ON "booking_seats"  ("showing_id", "row", "seat") `,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_8815ee8ca8bf44326ed49b459fa" FOREIGN KEY ("showing_id") REFERENCES "showings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "showings" ADD CONSTRAINT "FK_f466787e0a7c6d00ca553573a7c" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "showings" ADD CONSTRAINT "FK_c1e6cac97305ceb1b70b72e56c5" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_seats" ADD CONSTRAINT "FK_25c8b5c1e010af1cd2f699c5926" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_seats" ADD CONSTRAINT "FK_509c870b65f67f2123118f693ae" FOREIGN KEY ("showing_id") REFERENCES "showings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_seats" DROP CONSTRAINT "FK_509c870b65f67f2123118f693ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_seats" DROP CONSTRAINT "FK_25c8b5c1e010af1cd2f699c5926"`,
    );
    await queryRunner.query(
      `ALTER TABLE "showings" DROP CONSTRAINT "FK_c1e6cac97305ceb1b70b72e56c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "showings" DROP CONSTRAINT "FK_f466787e0a7c6d00ca553573a7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_8815ee8ca8bf44326ed49b459fa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c752dcc1749f6a2c89819b50b5"`,
    );
    await queryRunner.query(`DROP TABLE "booking_seats"`);
    await queryRunner.query(`DROP TABLE "showings"`);
    await queryRunner.query(`DROP TABLE "halls"`);
    await queryRunner.query(`DROP TABLE "films"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
  }
}
