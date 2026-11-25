-- AlterTable
ALTER TABLE "CorteCaja" ADD COLUMN     "ingresos" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "sitioWeb" TEXT,
ADD COLUMN     "telefono2" TEXT,
ADD COLUMN     "whatsapp" TEXT;

