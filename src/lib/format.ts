const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function ars(value: number): string {
  return arsFormatter.format(value ?? 0);
}

const numberFormatter = new Intl.NumberFormat("es-AR");

export function n(value: number): string {
  return numberFormatter.format(value ?? 0);
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export const motivosLabels: Record<string, string> = {
  otro: "Otro",
  precio: "Precio",
  stock: "Sin stock",
  envio: "Problema de envío",
  cliente: "Cliente pidió cancelar",
};