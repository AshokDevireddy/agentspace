"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import React from "react"
import { createClient } from '@supabase/supabase-js'
import { useAuth } from "@/providers/AuthProvider"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Dummy LOA contracts
const loaContracts = [
  { id: "1", name: "Schwartz, Joseph: GNW6138365" },
  { id: "2", name: "Phillips, Adam: TEW6012567" },
  { id: "3", name: "Perichitch, Milutin: TEW6012568" },
]

// Dummy agent payrolls
const agentPayrolls = [
  { id: "1", name: "2025-05-18" },
  { id: "2", name: "2025-05-11" },
  { id: "3", name: "2025-05-04" },
]

// Carrier options - using names that match the database
const carrierOptions = [
  { id: "Aetna", name: "Aetna", fileType: "Excel", fileInfo: "Excel file with data in 'Commission Details' sheet" },
  { id: "Aflac", name: "Aflac", fileType: "CSV", fileInfo: "CSV file with commission data" },
  { id: "AMAM", name: "American Amicable", fileType: "CSV", fileInfo: "CSV file with commission data" },
  { id: "FORESTERS", name: "Foresters Financial", fileType: "CSV", fileInfo: "CSV file with commission data" },
  { id: "BALTIMORE", name: "Baltimore Life", fileType: "CSV", fileInfo: "CSV file with commission data" },
  { id: "GTL", name: "Guarantee Trust Life", fileType: "CSV", fileInfo: "CSV file with commission data" },
  { id: "RNA", name: "Royal Neighbors of America", fileType: "CSV", fileInfo: "CSV file with commission data" },
  { id: "LBL", name: "Liberty Bankers Life", fileType: "CSV", fileInfo: "CSV file with commission data" },
  { id: "TIER", name: "TIER Financial Services", fileType: "CSV", fileInfo: "CSV file with commission data" },
]

interface ImportCommissionModalProps {
  trigger?: React.ReactNode
  selectedCarrier?: string | null
}

export default function ImportCommissionModal({ trigger, selectedCarrier }: ImportCommissionModalProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userInfo, setUserInfo] = useState<{ id: string; agency_id: string | null } | null>(null)
  const [formData, setFormData] = useState({
    loaContract: "",
    agentPayroll: "",
    date: "2025-06-05",
    amount: "",
    paymentIdentifier: "",
    reportFile: null as File | null,
    leadFeePercentage: "0",
    carrierId: selectedCarrier || "",
  })

  // Fetch user info when user is available
  useEffect(() => {
    const fetchUserInfo = async () => {
      console.log('=== MODAL: Fetching User Info ===')
      console.log('Auth user object:', user)
      console.log('Auth user ID:', user?.id)
      console.log('Auth user email:', user?.email)

      if (!user?.id) {
        console.log('No user ID available, skipping fetch')
        return
      }

      console.log('Querying users table for ID:', user.id)

      try {
       const { data: userData, error } = await supabase
          .from('users')
          .select('id, agency_id, email, first_name, last_name')
          .eq('auth_user_id', user.id)
          .single()

        console.log('Database query result:', { userData, error })

        if (error) {
          console.error('Error fetching user info from users table:', error)
          console.log('Trying to find user with different approaches...')

          // Try fetching all users to see what's in the table
          const { data: allUsers, error: allUsersError } = await supabase
            .from('users')
            .select('id, email, first_name, last_name')
            .limit(5)

          console.log('Sample users in table:', allUsers)
          console.log('All users query error:', allUsersError)

          // Try searching by email if available
          if (user.email) {
            console.log('Trying to find user by email:', user.email)
            const { data: userByEmail, error: emailError } = await supabase
              .from('users')
              .select('id, agency_id, email, first_name, last_name')
              .eq('email', user.email)
              .single()

            console.log('User found by email:', userByEmail)
            console.log('Email search error:', emailError)

            if (userByEmail && !emailError) {
              console.log('Found user by email, using that data')
              setUserInfo(userByEmail)
              return
            }
          }

          return
        }

        console.log('Successfully found user in database:', userData)
        setUserInfo(userData)
      } catch (error) {
        console.error('Unexpected error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [user])

  // Auto-open modal when selectedCarrier is provided
  React.useEffect(() => {
    if (selectedCarrier) {
      setIsOpen(true)
      setFormData(prev => ({ ...prev, carrierId: selectedCarrier }))
    }
  }, [selectedCarrier])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.reportFile) {
      alert('Please select a file to upload')
      return
    }

    if (!formData.carrierId) {
      alert('Please select a carrier')
      return
    }

    setIsSubmitting(true)

    try {
      const submitFormData = new FormData()
      submitFormData.append('file', formData.reportFile)
      submitFormData.append('data', JSON.stringify({
        loaContract: formData.loaContract,
        agentPayroll: formData.agentPayroll || null,
        date: formData.date,
        amount: formData.amount,
        paymentIdentifier: formData.paymentIdentifier,
        leadFeePercentage: formData.leadFeePercentage,
        carrierId: formData.carrierId,
        // Include user information
        userId: userInfo?.id || user?.id,
        agencyId: userInfo?.agency_id,
      }))

      console.log('=== MODAL: Preparing Upload ===')
      console.log('Current userInfo state:', userInfo)
      console.log('Current auth user:', user)
      console.log('Sending request with data:', {
        carrierId: formData.carrierId,
        fileName: formData.reportFile?.name,
        fileSize: formData.reportFile?.size,
        userInfoFromState: userInfo,
        userIdFromAuth: user?.id,
        agencyIdFromUserInfo: userInfo?.agency_id
      })

      const response = await fetch('/api/commission-reports/upload', {
        method: 'POST',
        body: submitFormData,
      })

      let result
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError)
        throw new Error(`Server returned invalid response (Status: ${response.status})`)
      }

      console.log('API Response:', { status: response.status, result })

      if (!response.ok) {
        const errorMessage = result.error || `Upload failed with status ${response.status}`
        const errorDetails = result.details ? `\n\nDetails: ${JSON.stringify(result.details, null, 2)}` : ''
        throw new Error(errorMessage + errorDetails)
      }

      console.log('Commission report uploaded successfully:', result)
      alert(`Commission report uploaded successfully! Processed ${result.processedCount} records, created ${result.commissionsCreated} commission transactions.`)

      // Reset form and close modal
      setIsOpen(false)
      setFormData({
        loaContract: "",
        agentPayroll: "",
        date: "2025-06-05",
        amount: "",
        paymentIdentifier: "",
        reportFile: null,
        leadFeePercentage: "0",
        carrierId: selectedCarrier || "",
      })

      // Optionally refresh the page or redirect to the commission reports page
      window.location.href = '/payments/reports'

    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Upload failed: ${errorMessage}`)

      // Log additional debug info
      console.error('Form data:', {
        carrierId: formData.carrierId,
        fileName: formData.reportFile?.name,
        fileSize: formData.reportFile?.size,
        amount: formData.amount,
        date: formData.date
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormData({ ...formData, reportFile: file })
  }

  const getExpectedFileType = (carrierId: string) => {
    const carrier = carrierOptions.find(c => c.id === carrierId)
    return carrier ? carrier.fileType : "CSV or Excel"
  }

  const getCarrierFileInfo = (carrierId: string) => {
    const carrier = carrierOptions.find(c => c.id === carrierId)
    return carrier ? carrier.fileInfo : "No additional information available"
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="blue" size="sm">
            Add Commission Report +
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-800">
            Import Carrier Commission Report
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* First Row - Carrier and LOA Contract */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Carrier Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Carrier *
              </label>
              <Select
                value={formData.carrierId}
                onValueChange={(value) =>
                  setFormData({ ...formData, carrierId: value })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a carrier" />
                </SelectTrigger>
                <SelectContent>
                  {carrierOptions.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LOA Contract */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                LOA Contract
              </label>
              <Select
                value={formData.loaContract}
                onValueChange={(value) =>
                  setFormData({ ...formData, loaContract: value })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Schwartz, Joseph: GNW6138365" />
                </SelectTrigger>
                <SelectContent>
                  {loaContracts.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Second Row - Agent Payroll and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agent Payroll */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Agent Payroll
              </label>
              <Select
                value={formData.agentPayroll}
                onValueChange={(value) =>
                  setFormData({ ...formData, agentPayroll: value })
                }
              >
                <SelectTrigger className="h-10 bg-blue-50">
                  <SelectValue placeholder="---------" />
                </SelectTrigger>
                <SelectContent>
                  {agentPayrolls.map((payroll) => (
                    <SelectItem key={payroll.id} value={payroll.id}>
                      {payroll.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Date
              </label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="h-10"
              />
            </div>
          </div>

          {/* Third Row - Amount, Payment Identifier, and Lead Fee */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Amount
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="h-10"
                placeholder="0.00"
              />
            </div>

            {/* Payment Identifier */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Payment Identifier
              </label>
              <Input
                type="text"
                value={formData.paymentIdentifier}
                onChange={(e) =>
                  setFormData({ ...formData, paymentIdentifier: e.target.value })
                }
                className="h-10"
                placeholder="Enter payment identifier"
              />
            </div>

            {/* Lead Fee Percentage */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Lead Fee %
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.leadFeePercentage}
                onChange={(e) =>
                  setFormData({ ...formData, leadFeePercentage: e.target.value })
                }
                className="h-10"
              />
            </div>
          </div>

          {/* Lead Fee Description */}
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            If specified, this percentage of each transaction will be paid to the LOA contract. This will only affect policies which did not come from a referral.
          </div>

          {/* Report File */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Report File *
            </label>
            <div className="flex items-center space-x-4 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => document.getElementById('reportFile')?.click()}
              >
                Choose File
              </Button>
              <span className="text-sm text-gray-600 flex-1">
                {formData.reportFile ? (
                  <span className="text-green-600">📄 {formData.reportFile.name}</span>
                ) : (
                  <span>
                    No file chosen - Select {getExpectedFileType(formData.carrierId)}
                  </span>
                )}
              </span>
              <input
                id="reportFile"
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".csv,.xlsx,.xls"
              />
            </div>
            {formData.carrierId && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                {getCarrierFileInfo(formData.carrierId)}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}