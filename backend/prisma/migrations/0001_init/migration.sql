-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'CAJERO', 'COMPRAS_ALMACEN');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('MOSTRADOR', 'EMPRESA', 'GARANTIA_EPSON');

-- CreateEnum
CREATE TYPE "PersonaFiscal" AS ENUM ('FISICA', 'MORAL');

-- CreateEnum
CREATE TYPE "TipoArticulo" AS ENUM ('CONSUMIBLE', 'REFACCION', 'EQUIPO_COMPUTO', 'SERVICIO');

-- CreateEnum
CREATE TYPE "TipoListaPrecio" AS ENUM ('PUBLICO', 'EMPRESA', 'MAYOREO');

-- CreateEnum
CREATE TYPE "TipoMovInventario" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE', 'APARTADO', 'LIBERACION_APARTADO');

-- CreateEnum
CREATE TYPE "EstatusOrdenCompra" AS ENUM ('BORRADOR', 'ENVIADA', 'PARCIAL', 'RECIBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO');

-- CreateEnum
CREATE TYPE "TipoVenta" AS ENUM ('TICKET', 'FACTURA', 'COTIZACION', 'APARTADO');

-- CreateEnum
CREATE TYPE "EstatusOrden" AS ENUM ('RECIBIDO', 'EN_DIAGNOSTICO', 'ESPERANDO_AUTORIZACION', 'EN_TRAMITE_GARANTIA_EPSON', 'ESPERANDO_REFACCION', 'EN_REPARACION', 'EN_PRUEBAS_CALIDAD', 'LISTO_ENTREGA_REPARADO', 'LISTO_ENTREGA_SIN_REPARAR', 'ENTREGADO', 'ABANDONO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoGarantia" AS ENUM ('NINGUNA', 'EPSON', 'TALLER');

-- CreateEnum
CREATE TYPE "EstatusProyecto" AS ENUM ('COTIZACION', 'EN_CURSO', 'PAUSADO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CentroCosto" AS ENUM ('TALLER', 'MOSTRADOR', 'PROYECTOS');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "regimenFiscal" TEXT,
    "cpFiscal" TEXT,
    "logoUrl" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "diasAbandono" INTEGER NOT NULL DEFAULT 90,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "pinHash" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "roles" "RolUsuario"[],
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalle" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaMensaje" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "asunto" TEXT,
    "cuerpo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlantillaMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'MOSTRADOR',
    "personaFiscal" "PersonaFiscal" NOT NULL DEFAULT 'FISICA',
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "regimenFiscal" TEXT,
    "usoCfdi" TEXT,
    "cpFiscal" TEXT,
    "creditoAutorizado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactoCliente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "puesto" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContactoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DireccionCliente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "etiqueta" TEXT,
    "calle" TEXT,
    "numero" TEXT,
    "colonia" TEXT,
    "cp" TEXT,
    "ciudad" TEXT,
    "estado" TEXT,
    "referencias" TEXT,

    CONSTRAINT "DireccionCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "accesorios" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoArticulo" NOT NULL,
    "sku" TEXT,
    "codigoBarras" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" INTEGER,
    "marcaId" INTEGER,
    "claveProdServSat" TEXT,
    "claveUnidadSat" TEXT,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "costoPromedio" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "controlStock" BOOLEAN NOT NULL DEFAULT true,
    "controlSerie" BOOLEAN NOT NULL DEFAULT false,
    "controlLote" BOOLEAN NOT NULL DEFAULT false,
    "fotoUrl" TEXT,
    "publicarEnTienda" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioProducto" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "lista" "TipoListaPrecio" NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PrecioProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilidadRefaccion" (
    "id" SERIAL NOT NULL,
    "refaccionId" INTEGER NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,

    CONSTRAINT "CompatibilidadRefaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Existencia" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "disponible" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "apartado" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minimo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "maximo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Existencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "tipo" "TipoMovInventario" NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "costoUnit" DECIMAL(14,4),
    "motivo" TEXT,
    "refTipo" TEXT,
    "refId" TEXT,
    "serie" TEXT,
    "lote" TEXT,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "esEpson" BOOLEAN NOT NULL DEFAULT false,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estatus" "EstatusOrdenCompra" NOT NULL DEFAULT 'BORRADOR',
    "xmlProveedor" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleCompra" (
    "id" SERIAL NOT NULL,
    "ordenCompraId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "cantidadRecibida" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "costoUnit" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "DetalleCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoProveedor" (
    "id" SERIAL NOT NULL,
    "ordenCompraId" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "forma" "FormaPago" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "tipo" "TipoVenta" NOT NULL DEFAULT 'TICKET',
    "clienteId" INTEGER,
    "cajeroId" INTEGER,
    "corteCajaId" INTEGER,
    "ordenTrabajoId" INTEGER,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cfdiUuid" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnit" DECIMAL(14,2) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "importe" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoVenta" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "forma" "FormaPago" NOT NULL,
    "refPago" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorteCaja" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fondoApertura" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalEfectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTarjeta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "retiros" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "arqueo" DECIMAL(14,2),
    "diferencia" DECIMAL(14,2),
    "abiertoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "CorteCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenTrabajo" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "equipoId" INTEGER NOT NULL,
    "tecnicoId" INTEGER,
    "estatus" "EstatusOrden" NOT NULL DEFAULT 'RECIBIDO',
    "tipoGarantia" "TipoGarantia" NOT NULL DEFAULT 'NINGUNA',
    "fallaReportada" TEXT NOT NULL,
    "estadoFisico" TEXT,
    "accesorios" TEXT,
    "fotos" JSONB,
    "qrToken" TEXT NOT NULL,
    "diagnostico" TEXT,
    "costoDiagnostico" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cotizacionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "autorizadaEn" TIMESTAMP(3),
    "autorizadaPor" TEXT,
    "recibidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prometidaEn" TIMESTAMP(3),
    "entregadaEn" TIMESTAMP(3),
    "firmaEntregaUrl" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BitacoraOrden" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "estatus" "EstatusOrden" NOT NULL,
    "nota" TEXT,
    "soloInterno" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BitacoraOrden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumoRefaccion" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "costoUnit" DECIMAL(14,4) NOT NULL,
    "precioUnit" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ConsumoRefaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estatus" "EstatusProyecto" NOT NULL DEFAULT 'COTIZACION',
    "alcance" TEXT,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaProyecto" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "responsable" TEXT,
    "avance" INTEGER NOT NULL DEFAULT 0,
    "horas" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "EtapaProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitaProyecto" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nota" TEXT,

    CONSTRAINT "VisitaProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "centroCosto" "CentroCosto" NOT NULL DEFAULT 'TALLER',
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "comprobanteUrl" TEXT,
    "xmlUrl" TEXT,
    "esCajaChica" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contador" (
    "clave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Contador_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaMensaje_clave_key" ON "PlantillaMensaje"("clave");

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "Cliente_rfc_idx" ON "Cliente"("rfc");

-- CreateIndex
CREATE INDEX "Equipo_numeroSerie_idx" ON "Equipo"("numeroSerie");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_nombre_key" ON "Marca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_sku_key" ON "Producto"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Producto_nombre_idx" ON "Producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioProducto_productoId_lista_key" ON "PrecioProducto"("productoId", "lista");

-- CreateIndex
CREATE INDEX "CompatibilidadRefaccion_marca_modelo_idx" ON "CompatibilidadRefaccion"("marca", "modelo");

-- CreateIndex
CREATE UNIQUE INDEX "Existencia_productoId_key" ON "Existencia"("productoId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_productoId_creadoEn_idx" ON "MovimientoInventario"("productoId", "creadoEn");

-- CreateIndex
CREATE INDEX "MovimientoInventario_refTipo_refId_idx" ON "MovimientoInventario"("refTipo", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_folio_key" ON "OrdenCompra"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_folio_key" ON "Venta"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_ordenTrabajoId_key" ON "Venta"("ordenTrabajoId");

-- CreateIndex
CREATE INDEX "Venta_creadoEn_idx" ON "Venta"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenTrabajo_folio_key" ON "OrdenTrabajo"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenTrabajo_qrToken_key" ON "OrdenTrabajo"("qrToken");

-- CreateIndex
CREATE INDEX "OrdenTrabajo_estatus_idx" ON "OrdenTrabajo"("estatus");

-- CreateIndex
CREATE INDEX "OrdenTrabajo_clienteId_idx" ON "OrdenTrabajo"("clienteId");

-- CreateIndex
CREATE INDEX "BitacoraOrden_ordenId_creadoEn_idx" ON "BitacoraOrden"("ordenId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_folio_key" ON "Proyecto"("folio");

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoCliente" ADD CONSTRAINT "ContactoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DireccionCliente" ADD CONSTRAINT "DireccionCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProducto" ADD CONSTRAINT "PrecioProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilidadRefaccion" ADD CONSTRAINT "CompatibilidadRefaccion_refaccionId_fkey" FOREIGN KEY ("refaccionId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Existencia" ADD CONSTRAINT "Existencia_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_corteCajaId_fkey" FOREIGN KEY ("corteCajaId") REFERENCES "CorteCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "OrdenTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoVenta" ADD CONSTRAINT "PagoVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteCaja" ADD CONSTRAINT "CorteCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajo" ADD CONSTRAINT "OrdenTrabajo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajo" ADD CONSTRAINT "OrdenTrabajo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajo" ADD CONSTRAINT "OrdenTrabajo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraOrden" ADD CONSTRAINT "BitacoraOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraOrden" ADD CONSTRAINT "BitacoraOrden_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoRefaccion" ADD CONSTRAINT "ConsumoRefaccion_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoRefaccion" ADD CONSTRAINT "ConsumoRefaccion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaProyecto" ADD CONSTRAINT "EtapaProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaProyecto" ADD CONSTRAINT "VisitaProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

