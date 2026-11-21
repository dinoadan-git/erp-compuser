-- AlterTable
ALTER TABLE "OrdenTrabajo" ADD COLUMN     "anticipo" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AnticipoOrden" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "forma" "FormaPago" NOT NULL,
    "corteCajaId" INTEGER,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnticipoOrden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnticipoOrden_ordenId_key" ON "AnticipoOrden"("ordenId");

-- CreateIndex
CREATE INDEX "AnticipoOrden_corteCajaId_idx" ON "AnticipoOrden"("corteCajaId");

-- CreateIndex
CREATE INDEX "OrdenTrabajo_recibidaEn_idx" ON "OrdenTrabajo"("recibidaEn");

-- AddForeignKey
ALTER TABLE "AnticipoOrden" ADD CONSTRAINT "AnticipoOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnticipoOrden" ADD CONSTRAINT "AnticipoOrden_corteCajaId_fkey" FOREIGN KEY ("corteCajaId") REFERENCES "CorteCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnticipoOrden" ADD CONSTRAINT "AnticipoOrden_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

