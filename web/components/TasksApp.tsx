"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import SignIn from "./SignIn";
import TaskBoard from "./TaskBoard";

export default function TasksApp() {
  // undefined until the stored session has been read.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="flex-1" aria-busy="true" />;
  }
  return session ? <TaskBoard user={session.user} /> : <SignIn />;
}
