-- CreateEnum
CREATE TYPE "ConceptoPagoProyecto" AS ENUM ('ANTICIPO', 'AVANCE', 'CIERRE');

-- CreateTable
CREATE TABLE "PagoProyecto" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "concepto" "ConceptoPagoProyecto" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolizaMantenimiento" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolizaMantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioProgramado" (
    "id" SERIAL NOT NULL,
    "polizaId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "realizado" BOOLEAN NOT NULL DEFAULT false,
    "realizadoEn" TIMESTAMP(3),

    CONSTRAINT "ServicioProgramado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PagoProyecto" ADD CONSTRAINT "PagoProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolizaMantenimiento" ADD CONSTRAINT "PolizaMantenimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioProgramado" ADD CONSTRAINT "ServicioProgramado_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "PolizaMantenimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

