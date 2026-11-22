-- Add an optional map pin to saved delivery addresses.
ALTER TABLE "address" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "address" ADD COLUMN "longitude" DOUBLE PRECISION;
