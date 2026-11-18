import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Empresa
  await prisma.empresa.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, nombre: 'Centro de Servicio Autorizado EPSON', diasAbandono: 90 },
  });

  const pass = await bcrypt.hash('cambiar123', 10);
  const pin = await bcrypt.hash('1234', 10);

  const usuarios = [
    { nombre: 'Administrador', email: 'admin@csa.local', roles: ['ADMINISTRADOR'] as const },
    { nombre: 'Recepcion', email: 'recepcion@csa.local', roles: ['RECEPCION'] as const },
    { nombre: 'Tecnico', email: 'tecnico@csa.local', roles: ['TECNICO'] as const },
    { nombre: 'Cajero', email: 'cajero@csa.local', roles: ['CAJERO'] as const },
    { nombre: 'Compras', email: 'compras@csa.local', roles: ['COMPRAS_ALMACEN'] as const },
  ];
  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { nombre: u.nombre, email: u.email, passwordHash: pass, pinHash: pin, roles: [...u.roles] },
    });
  }

  // Cliente y equipo demo (datos ficticios)
  const cliente = await prisma.cliente.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, nombre: 'Cliente Demo', tipo: 'MOSTRADOR' },
  });
  await prisma.equipo.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, clienteId: cliente.id, tipo: 'Impresora', marca: 'EPSON', modelo: 'L3250', numeroSerie: 'DEMO-0001' },
  });

  // Producto demo + existencia
  const prod = await prisma.producto.upsert({
    where: { sku: 'TINTA-003' },
    update: {},
    create: { sku: 'TINTA-003', nombre: 'Botella de tinta EPSON 003 Negro', tipo: 'CONSUMIBLE', tasaIva: 16 },
  });
  await prisma.existencia.upsert({
    where: { productoId: prod.id },
    update: {},
    create: { productoId: prod.id, disponible: 10, minimo: 2, maximo: 20 },
  });
  await prisma.precioProducto.upsert({
    where: { productoId_lista: { productoId: prod.id, lista: 'PUBLICO' } },
    update: {},
    create: { productoId: prod.id, lista: 'PUBLICO', precio: 199.0 },
  });

  console.log('Seed completado. Login: admin@csa.local / cambiar123 (PIN 1234)');
}

main().finally(() => prisma.$disconnect());
