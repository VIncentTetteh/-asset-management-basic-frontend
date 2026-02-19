import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Building2, Layers, Hexagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-slate-900">Welcome to Asset Manager</h1>
        <p className="text-xl text-slate-500 max-w-2xl">
          Efficiently manage your organization&apos;s structure and assets. Track lifecycles, assign resources, and maintain oversight across departments.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/assets">
              Manage Assets <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/organisations">View Organisations</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Organisations
            </CardTitle>
            <CardDescription>Manage company structures</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">
              Create and manage top-level organisations. Define the root of your asset hierarchy.
            </p>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/organisations">Go to Organisations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Departments
            </CardTitle>
            <CardDescription>Organize teams and units</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">
              Structure your organisations into departments. Assign assets to specific units.
            </p>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/departments">Go to Departments</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hexagon className="h-5 w-5 text-blue-600" />
              Assets
            </CardTitle>
            <CardDescription>Track equipment and resources</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">
              Full lifecycle management for assets. Purchase, assign, and track status.
            </p>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/assets">Go to Assets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
