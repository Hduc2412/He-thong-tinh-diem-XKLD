export function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export function mapCustomerStatus(status) {
  const labels = {
    REGISTERED: "Da dang ky",
    INTERVIEW_DONE: "Da phong van",
    PASSED: "Da dat",
    DEPARTED: "Da xuat canh",
  };

  return labels[status] || status;
}

export function statusVariant(status = "") {
  if (status.includes("Da") || status.includes("Hoat")) return "success";
  if (status.includes("Cho")) return "warning";
  if (status.includes("Tu") || status.includes("Tam")) return "destructive";
  return "secondary";
}
