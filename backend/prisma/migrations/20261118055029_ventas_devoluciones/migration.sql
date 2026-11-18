-- AlterEnum
ALTER TYPE "TipoVenta" ADD VALUE 'NOTA_CREDITO';

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "ventaOrigenId" INTEGER;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_ventaOrigenId_fkey" FOREIGN KEY ("ventaOrigenId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
