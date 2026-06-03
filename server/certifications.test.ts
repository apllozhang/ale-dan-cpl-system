import { describe, it, expect, beforeAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("certifications DB", () => {
  it("listCertifications returns paginated results", async () => {
    const { listCertifications } = await import("./db");
    const result = await listCertifications({ page: 1, pageSize: 10 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("getCertificationById returns null for non-existent id", async () => {
    const { getCertificationById } = await import("./db");
    const result = await getCertificationById(999999);
    expect(result).toBeNull();
  });

  it("getCertificationsByProduct returns array", async () => {
    const { getCertificationsByProduct } = await import("./db");
    const result = await getCertificationsByProduct("NONEXISTENT-MODEL");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getExpiringCertifications returns array", async () => {
    const { getExpiringCertifications } = await import("./db");
    const result = await getExpiringCertifications(90);
    expect(Array.isArray(result)).toBe(true);
  });

  it("createCertification returns insertId", async () => {
    const { createCertification } = await import("./db");
    const id = await createCertification({
      certType: "product",
      certNo: `TEST-${Date.now()}`,
      certName: "Test Cert",
      issuer: "Test Issuer",
      holder: "Test Holder",
      issueDate: "2025-01-01",
      status: "active",
      createdBy: 1,
    }, ["MODEL-A", "MODEL-B"]);
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("updateCertification succeeds", async () => {
    const { createCertification, updateCertification, getCertificationById } = await import("./db");
    const id = await createCertification({
      certType: "enterprise",
      certNo: `UPD-${Date.now()}`,
      certName: "To Update",
      issuer: "Issuer",
      holder: "Holder",
      issueDate: "2025-01-01",
      status: "active",
      createdBy: 1,
    });
    await updateCertification(id, { certName: "Updated Name" });
    const cert = await getCertificationById(id);
    expect(cert?.certName).toBe("Updated Name");
  });

  it("deleteCertification cascades to product_certifications", async () => {
    const { createCertification, deleteCertification, getCertificationsByProduct } = await import("./db");
    const id = await createCertification({
      certType: "product",
      certNo: `DEL-${Date.now()}`,
      certName: "To Delete",
      issuer: "Issuer",
      holder: "Holder",
      issueDate: "2025-01-01",
      status: "active",
      createdBy: 1,
    }, ["DEL-MODEL"]);
    await deleteCertification(id);
    const certs = await getCertificationsByProduct("DEL-MODEL");
    expect(certs.length).toBe(0);
  });
});
