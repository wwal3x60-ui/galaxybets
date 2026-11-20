import React from "react";
import { AccountLayout } from "@/components/account/AccountLayout";

export default function AccountLayoutRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountLayout>{children}</AccountLayout>;
}
