import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
              <p className="text-gray-600">
                You don't have permission to access this page. This area is restricted to administrators only.
              </p>
            </div>

            <div className="space-y-2">
              <Link href="/">
                <Button className="w-full">
                  Return to Dashboard
                </Button>
              </Link>
              <p className="text-sm text-gray-500">
                If you believe this is an error, please contact your administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}