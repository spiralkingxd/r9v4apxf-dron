"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  useEffect(() => {
    const finishLogin = async () => {
      const supabase = createClient();
      await supabase.auth.exchangeCodeForSession(window.location.href);
      window.location.href = "/";
    };
    finishLogin();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <h1>Autenticando...</h1>
      <p>Por favor, aguarde enquanto processamos seu login.</p>
    </div>
  );
}
