"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X, TrendingUp } from "lucide-react"

interface CarrierUpload {
  carrier: string
  file: File | null
}

const carriers = [
  'Aetna',
  'Aflac', 
  'American Amicable',
  'Combined Insurance',
  'American Home Life',
  'Royal Neighbors'
]

export default function UploadPolicyReportsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [uploads, setUploads] = useState<CarrierUpload[]>(
    carriers.map(carrier => ({ carrier, file: null }))
  )

  const handleFileUpload = (carrierIndex: number, file: File) => {
    const newUploads = [...uploads]
    newUploads[carrierIndex] = {
      ...newUploads[carrierIndex],
      file: file
    }
    setUploads(newUploads)
  }

  const handleFileRemove = (carrierIndex: number) => {
    const newUploads = [...uploads]
    newUploads[carrierIndex] = {
      ...newUploads[carrierIndex],
      file: null
    }
    setUploads(newUploads)
  }

  const handleAnalyze = async () => {
    const uploadedFiles = uploads.filter(upload => upload.file !== null)
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one policy report before analyzing.')
      return
    }

    try {
      // Create FormData to send files to API
      const formData = new FormData()
      
      uploadedFiles.forEach((upload, index) => {
        if (upload.file) {
          // Add file with carrier name as key
          formData.append(`carrier_${upload.carrier}`, upload.file)
        }
      })

      // Call both bucket and staging APIs in parallel
      const [bucketResponse, stagingResponse] = await Promise.all([
        fetch('/api/upload-policy-reports/bucket', {
          method: 'POST',
          body: formData,
        }),
        fetch('/api/upload-policy-reports/staging', {
          method: 'POST',
          body: formData,
        })
      ])

      const bucketResult = await bucketResponse.json()
      const stagingResult = await stagingResponse.json()

      // Handle bucket upload results
      if (bucketResult.success) {
        const replacementMessage = bucketResult.totalFilesReplaced > 0 
          ? ` and replaced ${bucketResult.totalFilesReplaced} existing file(s)`
          : ''
        console.log(`Successfully uploaded ${bucketResult.results.length} file(s)${replacementMessage} to ${bucketResult.bucketName} bucket!`)
      } else {
        console.error('Bucket upload failed:', bucketResult.errors?.join(', ') || bucketResult.detail)
      }

      // Handle staging upload results
      if (stagingResult.success) {
        console.log(`Successfully processed ${stagingResult.totalRecordsProcessed} records and inserted ${stagingResult.totalRecordsInserted} into staging table!`)
        alert(`Successfully uploaded files and processed ${stagingResult.totalRecordsInserted} policy records!`)
      } else {
        console.error('Staging upload failed:', stagingResult.errors?.join(', ') || stagingResult.detail)
        // Show staging errors to user
        if (stagingResult.errors && stagingResult.errors.length > 0) {
          alert(`File upload successful, but staging failed: ${stagingResult.errors.join(', ')}`)
        } else {
          alert(`File upload successful, but staging failed: ${stagingResult.detail}`)
        }
      }

      // Clear uploaded files after successful processing
      setUploads(carriers.map(carrier => ({ carrier, file: null })))

    } catch (error) {
      console.error('Error uploading files:', error)
      alert('An error occurred while uploading files. Please try again.')
    }

    onClose()
  }

  const handleCancel = () => {
    setUploads(carriers.map(carrier => ({ carrier, file: null })))
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-gray-900">
            Upload Policy Reports
          </DialogTitle>
          <p className="text-center text-gray-600 mt-2">
            Upload CSV or Excel files for each carrier to analyze persistency rates
          </p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 mt-8">
          {uploads.map((upload, index) => (
            <div key={upload.carrier} className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 text-center">
                {upload.carrier}
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center">
                {upload.file ? (
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {upload.file.name}
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      {(upload.file.size / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      onClick={() => handleFileRemove(index)}
                      className="bg-black text-white hover:bg-gray-800 px-4 py-2 text-sm"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Click to upload
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      CSV or Excel file
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(index, file)
                      }}
                      className="hidden"
                      id={`upload-${index}`}
                    />
                    <label
                      htmlFor={`upload-${index}`}
                      className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-sm text-gray-700"
                    >
                      Choose File
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center space-x-4 mt-8">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="px-6 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAnalyze}
            className="bg-black text-white hover:bg-gray-800 px-6 py-2"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Analyze Persistency
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
