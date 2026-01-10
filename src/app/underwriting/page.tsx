"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, ClipboardCheck, Trophy, TrendingUp, DollarSign, Award, ChevronDown, ChevronUp, RotateCcw, AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useMutation } from "@tanstack/react-query"

interface UnderwritingFormData {
  // Basic fields
  birthMonth: string
  birthDay: string
  birthYear: string
  sex: string
  smoker: string
  health: string
  faceAmount: string
  state: string
  zipCode: string

  // Advanced fields
  heightFeet: string
  heightInches: string
  weight: string
  systolic: string
  diastolic: string
  bloodPressureMedication: string
  cholesterolLevel: string
  hdlRatio: string
  cholesterolMedication: string
  periodCholesterol: string
  periodCholesterolControlDuration: string

  // Tobacco details
  doCigarettes: boolean
  periodCigarettes: string
  numCigarettes: string
  doCigars: boolean
  periodCigars: string
  numCigars: string
  doPipe: boolean
  periodPipe: string
  doChewingTobacco: boolean
  periodChewingTobacco: string
  doNicotinePatchesOrGum: boolean
  periodNicotinePatchesOrGum: string

  // Driving record
  hadDriversLicense: string
  movingViolations0: string
  movingViolations1: string
  movingViolations2: string
  movingViolations3: string
  movingViolations4: string
  recklessConviction: string
  dwiConviction: string
  suspendedConviction: string
  moreThanOneAccident: string
  periodRecklessConviction: string
  periodDwiConviction: string
  periodSuspendedConviction: string
  periodMoreThanOneAccident: string

  // Family history
  numDeaths: string
  numContracted: string

  // Substance abuse
  alcohol: string
  alcoholYearsSinceTreatment: string
  drugs: string
  drugsYearsSinceTreatment: string
}

interface UnderwritingResult {
  [key: string]: any
}

const INITIAL_FORM_DATA: UnderwritingFormData = {
  // Basic fields
  birthMonth: "",
  birthDay: "",
  birthYear: "",
  sex: "",
  smoker: "",
  health: "PP",
  faceAmount: "",
  state: "0",
  zipCode: "",

  // Advanced fields
  heightFeet: "",
  heightInches: "",
  weight: "",
  systolic: "",
  diastolic: "",
  bloodPressureMedication: "",
  cholesterolLevel: "",
  hdlRatio: "",
  cholesterolMedication: "",
  periodCholesterol: "",
  periodCholesterolControlDuration: "",

  // Tobacco details
  doCigarettes: false,
  periodCigarettes: "",
  numCigarettes: "",
  doCigars: false,
  periodCigars: "",
  numCigars: "",
  doPipe: false,
  periodPipe: "",
  doChewingTobacco: false,
  periodChewingTobacco: "",
  doNicotinePatchesOrGum: false,
  periodNicotinePatchesOrGum: "",

  // Driving record
  hadDriversLicense: "",
  movingViolations0: "",
  movingViolations1: "",
  movingViolations2: "",
  movingViolations3: "",
  movingViolations4: "",
  recklessConviction: "",
  dwiConviction: "",
  suspendedConviction: "",
  moreThanOneAccident: "",
  periodRecklessConviction: "",
  periodDwiConviction: "",
  periodSuspendedConviction: "",
  periodMoreThanOneAccident: "",

  // Family history
  numDeaths: "",
  numContracted: "",

  // Substance abuse
  alcohol: "",
  alcoholYearsSinceTreatment: "",
  drugs: "",
  drugsYearsSinceTreatment: "",
}

export default function UnderwritingPage() {
  const [formData, setFormData] = useState<UnderwritingFormData>(INITIAL_FORM_DATA)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // Track persisted results from localStorage (loaded on mount, synced after mutations)
  const [persistedResults, setPersistedResults] = useState<UnderwritingResult | null>(null)

  // Mutation for underwriting quote
  const underwritingMutation = useMutation({
    mutationFn: async (data: UnderwritingFormData) => {
      const response = await fetch('/api/underwriting/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to get underwriting quote')
      }

      // Sort results by monthly premium (lowest to highest)
      if (responseData.data?.Compulife_ComparisonResults?.Compulife_Results) {
        responseData.data.Compulife_ComparisonResults.Compulife_Results.sort((a: any, b: any) =>
          parseFloat(a.Compulife_premiumM) - parseFloat(b.Compulife_premiumM)
        )
      }

      return responseData
    },
    onSuccess: (data) => {
      // Persist to localStorage for future page loads
      try {
        localStorage.setItem('underwriting_results', JSON.stringify(data))
      } catch (error) {
        console.error('Error saving results:', error)
      }
      setPersistedResults(data)
    },
  })

  // Use mutation data if available, otherwise fall back to persisted results from localStorage
  const results = underwritingMutation.data || persistedResults
  // Use mutation error directly (no manual useState)
  const error = validationError || (underwritingMutation.error instanceof Error ? underwritingMutation.error.message : null)

  // Load saved state from localStorage on mount
  useEffect(() => {
    try {
      const savedFormData = localStorage.getItem('underwriting_form_data')
      const savedResults = localStorage.getItem('underwriting_results')
      const savedShowAdvanced = localStorage.getItem('underwriting_show_advanced')

      if (savedFormData) {
        setFormData(JSON.parse(savedFormData))
      }
      if (savedResults) {
        setPersistedResults(JSON.parse(savedResults))
      }
      if (savedShowAdvanced) {
        setShowAdvanced(JSON.parse(savedShowAdvanced))
      }
    } catch (error) {
      console.error('Error loading saved underwriting data:', error)
    }
  }, [])

  // Save form data and UI state to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('underwriting_form_data', JSON.stringify(formData))
    } catch (error) {
      console.error('Error saving form data:', error)
    }
  }, [formData])

  useEffect(() => {
    try {
      localStorage.setItem('underwriting_show_advanced', JSON.stringify(showAdvanced))
    } catch (error) {
      console.error('Error saving show advanced state:', error)
    }
  }, [showAdvanced])

  const handleInputChange = (field: keyof UnderwritingFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClearForm = () => {
    setFormData(INITIAL_FORM_DATA)
    setPersistedResults(null)
    setValidationError(null)
    setShowAdvanced(false)
    underwritingMutation.reset() // Clear mutation state
    // Clear from localStorage
    localStorage.removeItem('underwriting_form_data')
    localStorage.removeItem('underwriting_results')
    localStorage.removeItem('underwriting_show_advanced')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear any previous validation errors
    setValidationError(null)

    // Validate required button fields
    if (!formData.sex) {
      setValidationError('Please select sex')
      return
    }
    if (!formData.smoker) {
      setValidationError('Please select tobacco use status')
      return
    }

    // Clear persisted results when starting new query (mutation.data will take over)
    setPersistedResults(null)
    underwritingMutation.mutate(formData)
  }

  const months = [
    { value: "1", label: "Jan" },
    { value: "2", label: "Feb" },
    { value: "3", label: "Mar" },
    { value: "4", label: "Apr" },
    { value: "5", label: "May" },
    { value: "6", label: "Jun" },
    { value: "7", label: "Jul" },
    { value: "8", label: "Aug" },
    { value: "9", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dec" },
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i)

  // Calculate age dynamically
  const calculateAge = () => {
    if (!formData.birthMonth || !formData.birthDay || !formData.birthYear) return null

    const today = new Date()
    const birthDate = new Date(
      parseInt(formData.birthYear),
      parseInt(formData.birthMonth) - 1,
      parseInt(formData.birthDay)
    )

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  const calculatedAge = calculateAge()

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <ClipboardCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Life Insurance Underwriting</h1>
            <p className="text-muted-foreground mt-1">
              Get instant quotes from top-rated carriers powered by{' '}
              <a
                href="https://compulife.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:text-primary/80"
              >
                Compulife
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <Card className="shadow-lg border-2">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <CardTitle className="text-xl">Client Information</CardTitle>
          <CardDescription>
            Complete the form below to receive competitive quotes
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Compact 2-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date of Birth - Compact inline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Date of Birth *</Label>
                  {calculatedAge !== null && (
                    <span className="text-sm font-medium text-primary">
                      Age: {calculatedAge}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={formData.birthMonth}
                    onValueChange={(value) => handleInputChange('birthMonth', value)}
                    required
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.birthDay}
                    onChange={(e) => handleInputChange('birthDay', e.target.value)}
                    placeholder="Day"
                    className="h-10"
                    required
                  />
                  <Select
                    value={formData.birthYear}
                    onValueChange={(value) => handleInputChange('birthYear', value)}
                    required
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Face Amount */}
              <div className="space-y-2">
                <Label htmlFor="faceAmount" className="text-sm font-semibold">Coverage Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="faceAmount"
                    type="number"
                    min="1000"
                    step="1000"
                    value={formData.faceAmount}
                    onChange={(e) => handleInputChange('faceAmount', e.target.value)}
                    placeholder="500,000"
                    className="pl-7 h-10"
                    required
                  />
                </div>
              </div>

              {/* Sex - Button toggles */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Sex *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange('sex', 'M')}
                    className={`h-10 px-4 rounded-lg font-medium transition-all ${
                      formData.sex === 'M'
                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('sex', 'F')}
                    className={`h-10 px-4 rounded-lg font-medium transition-all ${
                      formData.sex === 'F'
                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>

              {/* Zip Code */}
              <div className="space-y-2">
                <Label htmlFor="zipCode" className="text-sm font-semibold">Zip Code *</Label>
                <Input
                  id="zipCode"
                  type="text"
                  maxLength={5}
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange('zipCode', e.target.value)}
                  placeholder="90210"
                  className="h-10"
                  required
                />
              </div>

              {/* Smoker Status - Button toggles */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tobacco Use *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange('smoker', 'N')}
                    className={`h-10 px-4 rounded-lg font-medium transition-all ${
                      formData.smoker === 'N'
                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    Non-Smoker
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('smoker', 'Y')}
                    className={`h-10 px-4 rounded-lg font-medium transition-all ${
                      formData.smoker === 'Y'
                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    Smoker
                  </button>
                </div>
              </div>

              {/* Health Rating */}
              <div className="space-y-2">
                <Label htmlFor="health" className="text-sm font-semibold">Health Class *</Label>
                <Select
                  value={formData.health}
                  onValueChange={(value) => handleInputChange('health', value)}
                  required
                >
                  <SelectTrigger id="health" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PP">Preferred Plus</SelectItem>
                    <SelectItem value="P">Preferred</SelectItem>
                    <SelectItem value="S">Standard</SelectItem>
                    <SelectItem value="ST">Standard Tobacco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Height & Weight with Advanced Options Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t items-end">
              <div className="space-y-2">
                <Label htmlFor="heightFeet" className="text-sm font-semibold">Height (Feet)</Label>
                <Input
                  id="heightFeet"
                  type="number"
                  min="3"
                  max="8"
                  value={formData.heightFeet}
                  onChange={(e) => handleInputChange('heightFeet', e.target.value)}
                  placeholder="5"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heightInches" className="text-sm font-semibold">Height (Inches)</Label>
                <Input
                  id="heightInches"
                  type="number"
                  min="0"
                  max="11"
                  value={formData.heightInches}
                  onChange={(e) => handleInputChange('heightInches', e.target.value)}
                  placeholder="10"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-sm font-semibold">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="50"
                  max="500"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  placeholder="180"
                  className="h-10"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-sm h-10"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Hide Advanced
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Advanced
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Advanced Options Content */}
            {showAdvanced && (
              <div className="space-y-5 p-6 bg-muted/30 rounded-lg border-2">
                {/* Blood Pressure */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Blood Pressure</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="systolic" className="text-xs">Systolic</Label>
                      <Input
                        id="systolic"
                        type="number"
                        min="60"
                        max="250"
                        value={formData.systolic}
                        onChange={(e) => handleInputChange('systolic', e.target.value)}
                        placeholder="120"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diastolic" className="text-xs">Diastolic</Label>
                      <Input
                        id="diastolic"
                        type="number"
                        min="40"
                        max="150"
                        value={formData.diastolic}
                        onChange={(e) => handleInputChange('diastolic', e.target.value)}
                        placeholder="80"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="bloodPressureMedication" className="text-xs">Medication</Label>
                      <Select
                        value={formData.bloodPressureMedication}
                        onValueChange={(value) => handleInputChange('bloodPressureMedication', value)}
                      >
                        <SelectTrigger id="bloodPressureMedication" className="h-9">
                          <SelectValue placeholder="No medication" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N">No medication</SelectItem>
                          <SelectItem value="Y">Taking medication</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Cholesterol */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Cholesterol</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="cholesterolLevel" className="text-xs">Total (mg/dL)</Label>
                      <Input
                        id="cholesterolLevel"
                        type="number"
                        min="100"
                        max="500"
                        value={formData.cholesterolLevel}
                        onChange={(e) => handleInputChange('cholesterolLevel', e.target.value)}
                        placeholder="200"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hdlRatio" className="text-xs">HDL Ratio</Label>
                      <Input
                        id="hdlRatio"
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={formData.hdlRatio}
                        onChange={(e) => handleInputChange('hdlRatio', e.target.value)}
                        placeholder="4.5"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cholesterolMedication" className="text-xs">Medication</Label>
                      <Select
                        value={formData.cholesterolMedication}
                        onValueChange={(value) => handleInputChange('cholesterolMedication', value)}
                      >
                        <SelectTrigger id="cholesterolMedication" className="h-9">
                          <SelectValue placeholder="No medication" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N">No medication</SelectItem>
                          <SelectItem value="Y">Taking medication</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="periodCholesterolControlDuration" className="text-xs">Yrs Controlled</Label>
                      <Input
                        id="periodCholesterolControlDuration"
                        type="number"
                        min="0"
                        max="50"
                        value={formData.periodCholesterolControlDuration}
                        onChange={(e) => handleInputChange('periodCholesterolControlDuration', e.target.value)}
                        placeholder="2"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Tobacco Details - Only show if smoker */}
                {formData.smoker === 'Y' && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold">Tobacco Details</h3>
                    <div className="space-y-4">
                      {/* Cigarettes */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="doCigarettes"
                            checked={formData.doCigarettes}
                            onCheckedChange={(checked) => handleInputChange('doCigarettes', checked as boolean)}
                          />
                          <Label htmlFor="doCigarettes" className="text-sm font-medium cursor-pointer">
                            Cigarettes
                          </Label>
                        </div>
                        {formData.doCigarettes && (
                          <div className="grid grid-cols-2 gap-4 pl-6">
                            <div className="space-y-2">
                              <Label htmlFor="periodCigarettes" className="text-sm">Years Smoked</Label>
                              <Input
                                id="periodCigarettes"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodCigarettes}
                                onChange={(e) => handleInputChange('periodCigarettes', e.target.value)}
                                placeholder="5"
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="numCigarettes" className="text-sm">Per Day</Label>
                              <Input
                                id="numCigarettes"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.numCigarettes}
                                onChange={(e) => handleInputChange('numCigarettes', e.target.value)}
                                placeholder="10"
                                className="h-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cigars */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="doCigars"
                            checked={formData.doCigars}
                            onCheckedChange={(checked) => handleInputChange('doCigars', checked as boolean)}
                          />
                          <Label htmlFor="doCigars" className="text-sm font-medium cursor-pointer">
                            Cigars
                          </Label>
                        </div>
                        {formData.doCigars && (
                          <div className="grid grid-cols-2 gap-4 pl-6">
                            <div className="space-y-2">
                              <Label htmlFor="periodCigars" className="text-sm">Years Smoked</Label>
                              <Input
                                id="periodCigars"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodCigars}
                                onChange={(e) => handleInputChange('periodCigars', e.target.value)}
                                placeholder="5"
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="numCigars" className="text-sm">Per Week</Label>
                              <Input
                                id="numCigars"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.numCigars}
                                onChange={(e) => handleInputChange('numCigars', e.target.value)}
                                placeholder="3"
                                className="h-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pipe */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="doPipe"
                            checked={formData.doPipe}
                            onCheckedChange={(checked) => handleInputChange('doPipe', checked as boolean)}
                          />
                          <Label htmlFor="doPipe" className="text-sm font-medium cursor-pointer">
                            Pipe
                          </Label>
                        </div>
                        {formData.doPipe && (
                          <div className="pl-6">
                            <div className="space-y-2">
                              <Label htmlFor="periodPipe" className="text-sm">Years Smoked</Label>
                              <Input
                                id="periodPipe"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodPipe}
                                onChange={(e) => handleInputChange('periodPipe', e.target.value)}
                                placeholder="5"
                                className="h-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chewing Tobacco */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="doChewingTobacco"
                            checked={formData.doChewingTobacco}
                            onCheckedChange={(checked) => handleInputChange('doChewingTobacco', checked as boolean)}
                          />
                          <Label htmlFor="doChewingTobacco" className="text-sm font-medium cursor-pointer">
                            Chewing Tobacco
                          </Label>
                        </div>
                        {formData.doChewingTobacco && (
                          <div className="pl-6">
                            <div className="space-y-2">
                              <Label htmlFor="periodChewingTobacco" className="text-sm">Years Used</Label>
                              <Input
                                id="periodChewingTobacco"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodChewingTobacco}
                                onChange={(e) => handleInputChange('periodChewingTobacco', e.target.value)}
                                placeholder="5"
                                className="h-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Nicotine Patches or Gum */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="doNicotinePatchesOrGum"
                            checked={formData.doNicotinePatchesOrGum}
                            onCheckedChange={(checked) => handleInputChange('doNicotinePatchesOrGum', checked as boolean)}
                          />
                          <Label htmlFor="doNicotinePatchesOrGum" className="text-sm font-medium cursor-pointer">
                            Nicotine Patches or Gum
                          </Label>
                        </div>
                        {formData.doNicotinePatchesOrGum && (
                          <div className="pl-6">
                            <div className="space-y-2">
                              <Label htmlFor="periodNicotinePatchesOrGum" className="text-sm">Duration (years)</Label>
                              <Input
                                id="periodNicotinePatchesOrGum"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodNicotinePatchesOrGum}
                                onChange={(e) => handleInputChange('periodNicotinePatchesOrGum', e.target.value)}
                                placeholder="1"
                                className="h-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Driving Record */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Driving Record</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Label className="text-sm">Have you ever had a driver's license?</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={formData.hadDriversLicense === 'Y' ? 'default' : 'outline'}
                          size="sm"
                          className="rounded-full px-6"
                          onClick={() => handleInputChange('hadDriversLicense', 'Y')}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant={formData.hadDriversLicense === 'N' ? 'default' : 'outline'}
                          size="sm"
                          className="rounded-full px-6"
                          onClick={() => handleInputChange('hadDriversLicense', 'N')}
                        >
                          No
                        </Button>
                      </div>
                    </div>

                    {formData.hadDriversLicense === 'Y' && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="movingViolations0" className="text-sm">This Year</Label>
                            <Input
                              id="movingViolations0"
                              type="number"
                              min="0"
                              max="20"
                              value={formData.movingViolations0}
                              onChange={(e) => handleInputChange('movingViolations0', e.target.value)}
                              placeholder="0"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="movingViolations1" className="text-sm">1 Yr Ago</Label>
                            <Input
                              id="movingViolations1"
                              type="number"
                              min="0"
                              max="20"
                              value={formData.movingViolations1}
                              onChange={(e) => handleInputChange('movingViolations1', e.target.value)}
                              placeholder="0"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="movingViolations2" className="text-sm">2 Yrs Ago</Label>
                            <Input
                              id="movingViolations2"
                              type="number"
                              min="0"
                              max="20"
                              value={formData.movingViolations2}
                              onChange={(e) => handleInputChange('movingViolations2', e.target.value)}
                              placeholder="0"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="movingViolations3" className="text-sm">3 Yrs Ago</Label>
                            <Input
                              id="movingViolations3"
                              type="number"
                              min="0"
                              max="20"
                              value={formData.movingViolations3}
                              onChange={(e) => handleInputChange('movingViolations3', e.target.value)}
                              placeholder="0"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="movingViolations4" className="text-sm">4 Yrs Ago</Label>
                            <Input
                              id="movingViolations4"
                              type="number"
                              min="0"
                              max="20"
                              value={formData.movingViolations4}
                              onChange={(e) => handleInputChange('movingViolations4', e.target.value)}
                              placeholder="0"
                              className="h-10"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="recklessConviction" className="text-sm">Reckless Driving Conviction</Label>
                            <Select
                              value={formData.recklessConviction}
                              onValueChange={(value) => handleInputChange('recklessConviction', value)}
                            >
                              <SelectTrigger id="recklessConviction" className="h-10">
                                <SelectValue placeholder="No" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Y">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {formData.recklessConviction === 'Y' && (
                            <div className="space-y-2">
                              <Label htmlFor="periodRecklessConviction" className="text-sm">Years Since</Label>
                              <Input
                                id="periodRecklessConviction"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodRecklessConviction}
                                onChange={(e) => handleInputChange('periodRecklessConviction', e.target.value)}
                                placeholder="3"
                                className="h-10"
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="dwiConviction" className="text-sm">DWI/DUI Conviction</Label>
                            <Select
                              value={formData.dwiConviction}
                              onValueChange={(value) => handleInputChange('dwiConviction', value)}
                            >
                              <SelectTrigger id="dwiConviction" className="h-10">
                                <SelectValue placeholder="No" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Y">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {formData.dwiConviction === 'Y' && (
                            <div className="space-y-2">
                              <Label htmlFor="periodDwiConviction" className="text-sm">Years Since</Label>
                              <Input
                                id="periodDwiConviction"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodDwiConviction}
                                onChange={(e) => handleInputChange('periodDwiConviction', e.target.value)}
                                placeholder="5"
                                className="h-10"
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="suspendedConviction" className="text-sm">License Suspended</Label>
                            <Select
                              value={formData.suspendedConviction}
                              onValueChange={(value) => handleInputChange('suspendedConviction', value)}
                            >
                              <SelectTrigger id="suspendedConviction" className="h-10">
                                <SelectValue placeholder="No" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Y">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {formData.suspendedConviction === 'Y' && (
                            <div className="space-y-2">
                              <Label htmlFor="periodSuspendedConviction" className="text-sm">Years Since</Label>
                              <Input
                                id="periodSuspendedConviction"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodSuspendedConviction}
                                onChange={(e) => handleInputChange('periodSuspendedConviction', e.target.value)}
                                placeholder="2"
                                className="h-10"
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="moreThanOneAccident" className="text-sm">More Than One Accident</Label>
                            <Select
                              value={formData.moreThanOneAccident}
                              onValueChange={(value) => handleInputChange('moreThanOneAccident', value)}
                            >
                              <SelectTrigger id="moreThanOneAccident" className="h-10">
                                <SelectValue placeholder="No" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Y">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {formData.moreThanOneAccident === 'Y' && (
                            <div className="space-y-2">
                              <Label htmlFor="periodMoreThanOneAccident" className="text-sm">Years Since Last</Label>
                              <Input
                                id="periodMoreThanOneAccident"
                                type="number"
                                min="0"
                                max="50"
                                value={formData.periodMoreThanOneAccident}
                                onChange={(e) => handleInputChange('periodMoreThanOneAccident', e.target.value)}
                                placeholder="1"
                                className="h-10"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Family Medical History */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Family Medical History</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="numDeaths" className="text-xs">Deaths before age 60</Label>
                      <Input
                        id="numDeaths"
                        type="number"
                        min="0"
                        max="20"
                        value={formData.numDeaths}
                        onChange={(e) => handleInputChange('numDeaths', e.target.value)}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numContracted" className="text-xs">With serious illness</Label>
                      <Input
                        id="numContracted"
                        type="number"
                        min="0"
                        max="20"
                        value={formData.numContracted}
                        onChange={(e) => handleInputChange('numContracted', e.target.value)}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Substance Abuse */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Substance Abuse Treatment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="alcohol" className="text-xs">Alcohol Treatment</Label>
                      <Select
                        value={formData.alcohol}
                        onValueChange={(value) => handleInputChange('alcohol', value)}
                      >
                        <SelectTrigger id="alcohol" className="h-9">
                          <SelectValue placeholder="No treatment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N">No treatment</SelectItem>
                          <SelectItem value="Y">Yes, had treatment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.alcohol === 'Y' && (
                      <div className="space-y-2">
                        <Label htmlFor="alcoholYearsSinceTreatment" className="text-xs">Years Since</Label>
                        <Input
                          id="alcoholYearsSinceTreatment"
                          type="number"
                          min="0"
                          max="50"
                          value={formData.alcoholYearsSinceTreatment}
                          onChange={(e) => handleInputChange('alcoholYearsSinceTreatment', e.target.value)}
                          placeholder="5"
                          className="h-9"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="drugs" className="text-xs">Drug Treatment</Label>
                      <Select
                        value={formData.drugs}
                        onValueChange={(value) => handleInputChange('drugs', value)}
                      >
                        <SelectTrigger id="drugs" className="h-9">
                          <SelectValue placeholder="No treatment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N">No treatment</SelectItem>
                          <SelectItem value="Y">Yes, had treatment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.drugs === 'Y' && (
                      <div className="space-y-2">
                        <Label htmlFor="drugsYearsSinceTreatment" className="text-xs">Years Since</Label>
                        <Input
                          id="drugsYearsSinceTreatment"
                          type="number"
                          min="0"
                          max="50"
                          value={formData.drugsYearsSinceTreatment}
                          onChange={(e) => handleInputChange('drugsYearsSinceTreatment', e.target.value)}
                          placeholder="5"
                          className="h-9"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit and Clear Buttons */}
            <div className="flex gap-3">
              <Button
                type="submit"
                size="lg"
                className="flex-1 h-12 text-base font-semibold shadow-lg"
                disabled={underwritingMutation.isPending}
              >
                {underwritingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Fetching Quotes...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="mr-2 h-5 w-5" />
                    Get Quotes from 100+ Carriers
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 px-6"
                onClick={handleClearForm}
                disabled={underwritingMutation.isPending}
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="mt-6 border-2 border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {results && results.data?.Compulife_ComparisonResults?.Compulife_Results && (
        <div className="mt-8 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-2 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">Best Rate</p>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">
                      ${parseFloat(results.data.Compulife_ComparisonResults.Compulife_Results[0].Compulife_premiumM).toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">per month</p>
                  </div>
                  <Trophy className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-2 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Average Rate</p>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                      ${(results.data.Compulife_ComparisonResults.Compulife_Results.reduce((sum: number, q: any) => sum + parseFloat(q.Compulife_premiumM), 0) / results.data.Compulife_ComparisonResults.Compulife_Results.length).toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">per month</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-2 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Total Carriers</p>
                    <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                      {results.data.Compulife_ComparisonResults.Compulife_Results.length}
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">quotes found</p>
                  </div>
                  <Award className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-2 border-orange-200 dark:border-orange-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">Coverage</p>
                    <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                      ${(parseInt(formData.faceAmount) / 1000)}K
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">face amount</p>
                  </div>
                  <DollarSign className="h-10 w-10 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Table */}
          <Card className="shadow-lg border-2">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">
                    {results.data.Compulife_ComparisonResults.Compulife_title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {formData.sex === 'M' ? 'Male' : 'Female'}, Age {results.data.Lookup.Birthdate.NearestAge}, {formData.smoker === 'Y' ? 'Smoker' : 'Non-Smoker'} • {results.data.Lookup.healthtxt}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b-2">
                    <tr>
                      <th className="text-left p-4 font-semibold text-sm">Rank</th>
                      <th className="text-left p-4 font-semibold text-sm">Company</th>
                      <th className="text-left p-4 font-semibold text-sm">Product</th>
                      <th className="text-center p-4 font-semibold text-sm">Rating</th>
                      <th className="text-left p-4 font-semibold text-sm">Health Class</th>
                      <th className="text-right p-4 font-semibold text-sm">Monthly</th>
                      <th className="text-right p-4 font-semibold text-sm">Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.Compulife_ComparisonResults.Compulife_Results.map((quote: any, index: number) => (
                      <tr
                        key={index}
                        className={`border-b hover:bg-muted/30 transition-colors ${
                          index === 0 ? 'bg-green-50/50 dark:bg-green-950/20' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {index === 0 && (
                              <Trophy className="h-5 w-5 text-yellow-500" />
                            )}
                            <span className={`font-bold ${index === 0 ? 'text-lg text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              #{index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-sm">{quote.Compulife_company}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{quote.Compulife_ambest}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm max-w-xs">{quote.Compulife_product.trim()}</div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            quote.Compulife_amb === 'A++' ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-900 dark:from-yellow-900 dark:to-amber-900 dark:text-amber-200 ring-2 ring-amber-400' :
                            quote.Compulife_amb === 'A+' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ring-2 ring-green-300' :
                            quote.Compulife_amb === 'A' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ring-2 ring-blue-300' :
                            quote.Compulife_amb === 'A-' ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 ring-2 ring-slate-300' :
                            quote.Compulife_amb === 'B++' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 ring-2 ring-orange-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {quote.Compulife_amb}
                          </span>
                        </td>
                        <td className="p-4 text-sm">{quote.Compulife_healthcat.trim()}</td>
                        <td className="p-4 text-right">
                          <div className={`font-bold text-lg ${index === 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                            ${parseFloat(quote.Compulife_premiumM).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">/month</div>
                        </td>
                        <td className="p-4 text-right text-muted-foreground">
                          <div className="font-semibold">${parseFloat(quote.Compulife_premiumAnnual).toFixed(2)}</div>
                          <div className="text-xs">/year</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Disclaimer Footer */}
              <div className="p-6 bg-muted/30 border-t-2 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">ℹ️</span>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-sm text-foreground">Important Disclosure</p>
                    <p>{results.data.Compulife_ComparisonResults.Compulife_Copyright}</p>
                    <p>
                      These quotes are estimates based on the information provided and are subject to full underwriting approval.
                      Actual rates may vary based on detailed health history, lifestyle factors, and individual carrier underwriting guidelines.
                      Always verify current rates and complete policy terms with the insurance carrier before making a decision.
                    </p>
                    <p className="text-xs">
                      Data as of: {results.data.AccessDate.month} {results.data.AccessDate.day}, {results.data.AccessDate.year} •
                      AM Best Ratings as of: {results.data.AccessDate.ambestdate}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
