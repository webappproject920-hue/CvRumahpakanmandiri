
/* =========================================
   RUMAH PAKAN MANDIRI — SUPABASE BACKEND
   CRUD layer; access controlled by Supabase RLS
========================================= */

(() => {
  const SUPABASE_URL = "https://hazyjojicbexqolgpsut.supabase.co";
  const SUPABASE_KEY = "sb_publishable_cbdtyiHw9j6AmGgp7KH0OQ_RYN_cdAM";

  if (!window.supabase) {
    console.error("Supabase JS belum dimuat.");
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  async function requireUser() {
    const { data, error } = await db.auth.getUser();

    if (error) throw error;
    if (!data.user) throw new Error("Silakan login terlebih dahulu.");

    return data.user;
  }

  async function login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const profile = await getProfile();

    if (!profile || !profile.is_active) {
      await db.auth.signOut();
      throw new Error("Akun tidak aktif atau profil belum tersedia.");
    }

    return { user: data.user, profile };
  }

  async function logout() {
    const { error } = await db.auth.signOut();
    if (error) throw error;
  }

  async function getProfile() {
    const user = await requireUser();

    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function getSession() {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function listRecords(moduleName) {
    if (!moduleName) throw new Error("Nama modul wajib diisi.");

    await requireUser();

    const { data, error } = await db
      .from("app_records")
      .select("*")
      .eq("module", moduleName)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function saveRecord(moduleName, recordKey, payload, recordDate = null) {
    if (!moduleName || !recordKey) {
      throw new Error("Nama modul dan kunci data wajib diisi.");
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Isi data harus berupa object.");
    }

    const user = await requireUser();

    // Cari data lama agar pembuat awal tidak tertimpa.
    const { data: existing, error: findError } = await db
      .from("app_records")
      .select("id")
      .eq("module", moduleName)
      .eq("record_key", String(recordKey))
      .maybeSingle();

    if (findError) throw findError;

    const values = {
      module: moduleName,
      record_key: String(recordKey),
      payload,
      record_date: recordDate || null,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };

    let result;

    if (existing) {
      result = await db
        .from("app_records")
        .update(values)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await db
        .from("app_records")
        .insert({
          ...values,
          created_by: user.id
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return result.data;
  }

  async function deleteRecord(moduleName, recordKey) {
    if (!moduleName || !recordKey) {
      throw new Error("Nama modul dan kunci data wajib diisi.");
    }

    await requireUser();

    const { error } = await db
      .from("app_records")
      .delete()
      .eq("module", moduleName)
      .eq("record_key", String(recordKey));

    if (error) throw error;
    return true;
  }

  window.RPMBackend = {
    login,
    logout,
    getProfile,
    getSession,
    listRecords,
    saveRecord,
    deleteRecord
  };
})();
