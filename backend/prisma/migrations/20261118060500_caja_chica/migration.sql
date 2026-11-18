-- CreateTable
CREATE TABLE "CajaChica" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fondo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CajaChica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReposicionCajaChica" (
    "id" SERIAL NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReposicionCajaChica_pkey" PRIMARY KEY ("id")
);

