import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard/next-move");
  return <>Coming Soon</>;
}
