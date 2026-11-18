-- CreateEnum
CREATE TYPE "EstatusNotificacion" AS ENUM ('SIMULADA', 'ENVIADA', 'SIN_DESTINO', 'ERROR');

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "evento" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "destino" TEXT,
    "mensaje" TEXT NOT NULL,
    "estatus" "EstatusNotificacion" NOT NULL DEFAULT 'SIMULADA',
    "clienteId" INTEGER,
    "ordenId" INTEGER,
    "ventaId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacion_ordenId_idx" ON "Notificacion"("ordenId");

-- CreateIndex
CREATE INDEX "Notificacion_creadoEn_idx" ON "Notificacion"("creadoEn");

