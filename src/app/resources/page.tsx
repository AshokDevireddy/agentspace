"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Phone, Clock, AlertTriangle, FileText, Download, ExternalLink, Printer, Globe } from "lucide-react"

// Carrier data - removed: GPM Life, Allstate, American National, Aspida, Columbus Life, John Hancock, Lafayette Life, Mutual Trust
// Logo images should be placed in /public/carriers/ folder with the carrier id as filename (e.g., american-amicable.png)
const carriers = [
  // Core Carriers
  { id: "american-amicable", name: "American Amicable Group", logo: "/carriers/american-amicable.png" },
  { id: "american-home-life", name: "American Home Life Insurance Company", logo: "/carriers/american-home-life.png" },
  { id: "americo", name: "Americo", logo: "/carriers/americo.png" },
  { id: "foresters", name: "Foresters Financial", logo: "/carriers/foresters.png" },
  { id: "legal-general", name: "Legal & General", logo: "/carriers/legal-general.png" },
  { id: "mutual-omaha", name: "Mutual of Omaha", logo: "/carriers/mutual-omaha.png" },
  { id: "national-life", name: "National Life Group", logo: "/carriers/national-life.png" },
  { id: "sbli", name: "SBLI", logo: "/carriers/sbli.png" },
  { id: "transamerica", name: "Transamerica", logo: "/carriers/transamerica.png" },
  { id: "united-home-life", name: "United Home Life Insurance Company", logo: "/carriers/united-home-life.png" },

  // UniTrust Carrier Network
  { id: "corebridge", name: "Corebridge Financial", logo: "/carriers/corebridge.png" },
  { id: "ethos", name: "Ethos", logo: "/carriers/ethos.png" },
  { id: "fg-annuities", name: "F&G Annuities & Life", logo: "/carriers/fg-annuities.png" },
  { id: "liberty-bankers", name: "Liberty Bankers Life", logo: "/carriers/liberty-bankers.png" },
]

export default function Resources() {
  const [selectedCarrier, setSelectedCarrier] = useState<typeof carriers[0] | null>(null)

  return (
    <div className="w-full h-[calc(100vh-2rem)] flex flex-col p-6 overflow-y-auto">
      <div className="professional-card p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">Carrier Resources</h1>
          <p className="text-muted-foreground">
            Click on any carrier to view their resources and information
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {carriers.map((carrier) => (
            <Card
              key={carrier.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 p-6 flex flex-col items-center justify-center bg-card border-2 border-border hover:border-primary group"
              onClick={() => setSelectedCarrier(carrier)}
            >
              <div className="w-full h-32 flex flex-col items-center justify-center gap-3">
                {carrier.logo ? (
                  <img
                    src={carrier.logo}
                    alt={carrier.name}
                    className="w-16 h-16 object-contain"
                    onError={(e) => {
                      // Fallback to icon if image fails to load
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors ${carrier.logo ? 'hidden' : ''}`}>
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-xs text-foreground line-clamp-3">
                    {carrier.name}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Carrier Modal */}
      <Dialog open={!!selectedCarrier} onOpenChange={() => setSelectedCarrier(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              {selectedCarrier?.logo ? (
                <img
                  src={selectedCarrier.logo}
                  alt={selectedCarrier.name}
                  className="w-20 h-20 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
              )}
              <div>
                <DialogTitle className="text-2xl">{selectedCarrier?.name}</DialogTitle>
                <DialogDescription>
                  Carrier resources and information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {selectedCarrier?.id === "american-amicable" && (
              <>
                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8007367311" className="text-primary hover:underline font-medium">
                        (800) 736-7311
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (254) 297-2100</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 8am-4pm CT</span>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Product Availability:</p>
                      <p className="text-foreground">American Amicable/Occidental products are not available in NY.</p>
                      <p className="text-foreground">Agents selling in IA, MA, MI, NJ, RI, & VT must sell Occidental rather than American Amicable.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: PA</p>
                      <p className="text-foreground">States where a license is required for override commissions: MT, NM, VA</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Phone Interviews:</p>
                      <p className="text-foreground">Call EMSI at <a href="tel:8667192024" className="text-primary hover:underline font-medium">866-719-2024</a></p>
                      <p className="text-foreground">EMSI hours: Monday - Friday 8am-9pm CT | Saturday 10am-2pm CT</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Software Download Notice:</p>
                      <p className="text-foreground">Am-Am software download is currently only available using Microsoft Internet Explorer. Many agents have trouble installing this software due to anti-virus programs blocking the download.</p>
                      <p className="text-foreground mt-2">If experiencing difficulty, contact American Amicable&apos;s Help Desk at <a href="tel:2542972808" className="text-primary hover:underline font-medium">254-297-2808 ext. 2808</a></p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Questionnaires and Forms */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Questionnaires & Forms
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { title: "Drug Use Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740417821418x589797356341949600/DRUG%20USE.pdf" },
                      { title: "Alcohol Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740417869989x961922310632002300/ALCOHOL.pdf" },
                      { title: "Tobacco Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740417890984x326265848114680960/TOBACCO.pdf" },
                      { title: "Asthma Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740417902008x515410321108768830/ASTHMA.pdf" },
                      { title: "High Blood Pressure Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740418252155x960101324089214500/HBP.pdf" },
                      { title: "Diabetes Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740418398507x355019978236532700/DIABETES.pdf" },
                      { title: "Cancer Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740418586053x909668298670878200/CANCER.pdf" },
                      { title: "Beneficiary Relationship Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740418595812x856713108512879400/BENE.pdf" },
                      { title: "Arthritis Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740418747471x895517299677315100/ARTHRITIS.pdf" },
                      { title: "Aviation Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740418794301x536997818883667500/AVIATION.pdf" },
                      { title: "Juvenile Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419012776x968127015875565300/JUVI.pdf" },
                      { title: "Non-USA Citizen Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419213403x568721568030192700/NONUSA.pdf" },
                      { title: "Residence and Travel Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419321109x948988329542191700/TRAVEL.pdf" },
                      { title: "Arrest Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419616156x584743226834777200/ARREST.pdf" },
                      { title: "Mountain Climbing Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419642960x638644510270315100/MT%20CLIMBING.pdf" },
                      { title: "Racing Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419661542x132799592934446100/RACING.pdf" },
                      { title: "Key Person Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419673297x813479562683872600/KEY%20PERSON.pdf" },
                      { title: "Mental Health Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419683319x788620133051897200/MENTAL%20HEALTH.pdf" },
                      { title: "Scuba Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740419695579x785745163639453700/SCUBA.pdf" },
                      { title: "Seizure / Epilepsy Questionnaire", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740420211334x617294834012620500/SEIZURE.pdf" },
                      { title: "AmAm Company Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740522425115x754541173919148500/AmAm%20Company%20Brochure.pdf" },
                    ].map((form, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(form.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{form.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* American Home Life */}
            {selectedCarrier?.id === "american-home-life" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.amhomelife.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.amhomelife.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.amhomelife.com/ahlcas/login?service=https://www.amhomelife.com/ahlsec2/servlet/mainlogin', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Login</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Carrier Information */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    About American Home Life
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="text-foreground">The American Home Life Insurance Company was founded in 1909 in Topeka, Kansas. Throughout the last 110+ years, our mutual corporate structure, conservative investment philosophy, and Midwestern value-oriented culture have enabled us to grow and prosper through multiple world wars, pandemics, and recessions all while fulfilling our obligations to our policyholders, agents, and employees.</p>
                    </div>
                    <div>
                      <p className="text-foreground">As a mutual insurance company, American Home Life is owned exclusively by its policyholders. This distinction means we can operate solely in policyholders' long-term interest without having to weigh the effects company decisions may have on shareholders' short-term interests.</p>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="font-semibold text-foreground mb-2">Contact Information:</p>
                      <p className="text-foreground">P.O. Box 1497</p>
                      <p className="text-foreground">400 S Kansas Ave</p>
                      <p className="text-foreground">Topeka, KS 66601</p>
                      <p className="text-foreground mt-2">
                        Phone: <a href="tel:8008760199" className="text-primary hover:underline font-medium">(800) 876-0199</a>
                      </p>
                      <p className="text-foreground">
                        Local: <a href="tel:7852356276" className="text-primary hover:underline font-medium">(785) 235-6276</a>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "Patriot Series Consumer Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1704414500666x929865864228276900/Consumer%20Brochure%20-%20PSFE.PDF" },
                      { title: "AHL Patriot Series Product Overview", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1704414517824x318135160497582850/Overview-PSFE.PDF" },
                      { title: "AHL Patriot Series Disease Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1704414537620x523929623065001660/Underwriting-PSFE-Disease%20Guide.pdf" },
                      { title: "AHL Patriot Series RX Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1704414555669x324040684135845440/Underwriting-PSFE-RX%20Guide.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Americo */}
            {selectedCarrier?.id === "americo" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.americo.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.americo.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://account.americoagent.com/Identity/Account/Login/?returnUrl=https://portal.americoagent.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Login</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8002310801" className="text-primary hover:underline font-medium">
                        (800) 231-0801
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (800) 395-9261</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 8am-5pm CT</span>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Product Availability:</p>
                      <p className="text-foreground">Americo products are not available in NY or VT.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: AL, GA, KY, LA, MT, OH, PA, WA, WI</p>
                      <p className="text-foreground mt-2">States where a license is required for override commissions: AL, FL, GA, KY, MA, MS, MT, ND, NM, PA, SD, UT, VA, WI</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Background Check Requirements:</p>
                      <p className="text-foreground">Americo has very strict requirements regarding agent background checks. If you have any financial or criminal issues in your background, please discuss this with your manager to find out whether you would be able to contract with Americo.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">E&O Insurance:</p>
                      <p className="text-foreground">E&O Insurance is required to sell all Life products with Americo. E&O is not required for Final Expense or Medicare Supplement products.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Phone Interviews:</p>
                      <p className="text-foreground">Call <a href="tel:8002310801" className="text-primary hover:underline font-medium">800-231-0801</a></p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Quoting Software */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quoting Software & Applications
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Online Quoting:</p>
                      <p className="text-foreground">To run quotes online, please log into Americo&apos;s Agent Portal. If you are not yet contracted with Americo, you may use the online tool at <a href="https://quote.americo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">quote.americo.com</a></p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">Software Application:</p>
                      <p className="text-foreground">Download the Americo software application and install it.</p>
                      <p className="text-foreground mt-1">Password: <span className="font-mono bg-muted px-2 py-1 rounded">ASUREA150</span></p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">E-Applications:</p>
                      <p className="text-foreground">Americo provides E-Apps for Eagle Premier, UltraProtector Series, and Home Mortgage Series</p>
                      <p className="text-foreground text-sm text-muted-foreground mt-1">*Americo log in info required*</p>
                    </div>
                  </div>
                </div>

                {/* Product Brochures */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Brochures & Resources
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "Americo Term and CBO Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740598464292x639801635890892900/Americo%20Term%20and%20CBO%20Brochure.pdf" },
                      { title: "Americo Payment Protector Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740598483008x439714124614544640/Americo%20Payment%20Protector.pdf" },
                      { title: "Americo Continuation Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740598503937x273406452180683170/Americo%20Continuation%20Brochure.pdf" },
                      { title: "Americo Eagle FE Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740598519360x700647718336657800/Americo%20Eagle%20FE%20Brochure.pdf" },
                      { title: "Americo IUL Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740598558720x973764136552721000/Americo%20IUL%20Brochure.pdf" },
                      { title: "Americo Strength Flyer", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740598616467x173211244250875740/Americo%20Strenth%20Flyer.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Foresters Financial */}
            {selectedCarrier?.id === "foresters" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.foresters.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.foresters.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.foresters.com/en/for-agents', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Portal</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8664667166" className="text-primary hover:underline font-medium">
                        (866) 466-7166
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (866) 300-3830</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 8:30am-7pm ET</span>
                    </div>
                  </div>
                </div>

                {/* Quote & App */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Quote & App
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Toolkit FE & Toolkit Term:</p>
                      <p className="text-foreground">(Not Available in Co-Pilot)</p>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: CT, LA, MA, NM, & PA</p>
                      <p className="text-foreground mt-2">States where a license is required for override commissions: FL, GA, MA, NM, PA</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Phone Interviews:</p>
                      <p className="text-foreground">Phone interviews are required for PlanRight applications. Agents must be appointed with Foresters in order to complete phone interviews.</p>
                      <p className="text-foreground mt-2">Call Apptical at <a href="tel:8668449276" className="text-primary hover:underline font-medium">866-844-9276</a></p>
                      <p className="text-foreground">Hours: Mon-Fri | 8:30am-12am ET, Sat-Sun | 10am-8pm ET</p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "Foresters Questionnaires for Application YES Answers (FL Forms)", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708700262144x500928674784655550/Foresters%20Questionnaires.pdf" },
                      { title: "Foresters Strong Foundation Consumer Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701236349x332222079607018560/foresters%20term%20brochure.pdf" },
                      { title: "Foresters ADBR Fact Sheet", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701254769x662724792699770800/foresters%20ADBR%20fact%20sheet.pdf" },
                      { title: "Foresters Member Benefits", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701273510x490503189689660800/foresters%20member%20benefits.pdf" },
                      { title: "Foresters Understanding Life Insurance", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701290369x124594999538464530/foresters%20life%20insurance%20understanding.pdf" },
                      { title: "Foresters Benefits for Those With Diabetes", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701316082x823472962435345400/foresters%20diabetes%20member%20benefits.pdf" },
                      { title: "Foresters Financial Strength", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701339130x537238200590537860/foresters%20financial%20strength.pdf" },
                      { title: "Foresters Planright FE Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701353864x750029456156984000/foresters%20planright%20brochure.pdf" },
                      { title: "Foresters Advantage Plus II WL Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701372930x277290244815793240/foresters%20advantage%20plus%202%20brochure.pdf" },
                      { title: "Foresters (Children) Bright Future WL Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701393174x245062877773044130/foresters%20bright%20future%20brochure.pdf" },
                      { title: "Foresters Smart UL Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701452466x479359262317917950/foresters%20smart%20UL%20brochure.pdf" },
                      { title: "Foresters Planright Submission & Phone Interview Process Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1708701601372x743805998017289700/Foresters%20Planright%20Submission%20%26%20Phone%20Interview%20Process.pdf" },
                      { title: "Foresters Live Well Plus Process Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1755730724565x384757257621271000/506513-us-0725-foresters-liveWellPlus-process-training.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Legal & General */}
            {selectedCarrier?.id === "legal-general" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.lgamerica.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.lgamerica.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* E-App & Quoting */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    E-App & Quoting
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="text-foreground">E-App & Quoting available only for preferred and standard risk class in UniTrust Co-Pilot Only.</p>
                      <p className="text-foreground text-sm text-muted-foreground mt-1">(Not available for quoting and e-app in the insurance toolkit)</p>
                    </div>
                  </div>
                </div>

                {/* Underwriting Guide */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Underwriting Resources
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="text-foreground mb-3">Quick reference underwriting guide to find out how to avoid apps requiring APS (Attending Physician Statement):</p>
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open('https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1733923855275x267910383807150140/LGA-living-benefits_product-overview.pdf', '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <FileText className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-semibold text-base text-foreground">Underwriting Guide</div>
                            <div className="text-sm text-muted-foreground">Quick reference guide</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "QLT Living Benefits Explained", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1733923855275x267910383807150140/LGA-living-benefits_product-overview.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Mutual of Omaha */}
            {selectedCarrier?.id === "mutual-omaha" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.mutualofomaha.com/welcome/getting-started', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.mutualofomaha.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www3.mutualofomaha.com/OktaSpaRegistration/home', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Sales Professional Access (SPA)</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8006936083" className="text-primary hover:underline font-medium">
                        (800) 693-6083
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (402) 997-1800</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 7:30am-5:30pm CT</span>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: MT, PA, & OK</p>
                      <p className="text-foreground mt-2">States where a license is required for override commissions: GA, MA, MT, NM, PA, UT, VA</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">E&O Insurance:</p>
                      <p className="text-foreground">MOO Life Products that require E&O Insurance are Income Advantage, Life Protection Advantage, AccumUL Answers, Term Life Answers</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Health License Requirement:</p>
                      <p className="text-foreground">Agents selling stand-alone DI or CI products must have a health license.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Product Updates:</p>
                      <p className="text-foreground">Effective February 1, 2022, the TLE 30T Return of Premium (ROP) product now has Critical Illness and Chronic Illness Riders (except in California) available in addition to the Terminal Illness Rider.</p>
                      <p className="text-foreground mt-2">You can now sell Living Benefits - at no additional cost - on IUL Express, TLE non-ROP and TLE ROP products.</p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "MOO Children's WL Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740602607746x759886442987724200/MOO%20Childrens%20Whole%20Life%20Brochure.pdf" },
                      { title: "MOO IUL Express Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740602621330x996433013136585100/MOO%20IUL%20Express%20Brochure.pdf" },
                      { title: "MOO Living Promise Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740602635923x145770842090311870/MOO%20Living%20Promise%20Brochure.pdf" },
                      { title: "MOO Strength Flyer", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740602647673x716399826288256500/MOO%20Strength%20Flyer.pdf" },
                      { title: "MOO Term and IUL Living Benefits Flyer", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740602659883x907591218217695700/MOO%20Term%20and%20IUL%20Living%20Benefits%20Flyer.pdf" },
                      { title: "MOO Term Life Express Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740602677359x868277700538092700/MOO%20Term%20Life%20Express%20Brochure.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* National Life Group */}
            {selectedCarrier?.id === "national-life" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.nationallife.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.nationallife.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://nlg-prod.auth0.com/login?state=hKFo2SBtcUluMmlMY3JfallaWjNjeTZvcllDLWZJRlFxN3FxeqFupWxvZ2luo3RpZNkgczNOMnVTUnB4TFU0amhNV2pYQTdCUFZuQmRMVzJ6bVqjY2lk2SBtSTV3MUlhVUpsY0FDamU3Mks5TlZGeHY5eEFnbVV0bQ&client=mI5w1IaUJlcACje72K9NVFxv9xAgmUtm&protocol=samlp', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">E-App Portal</div>
                          <div className="text-sm text-muted-foreground">Access e-applications</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8009063310" className="text-primary hover:underline font-medium">
                        (800) 906-3310
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (254) 297-2100</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 8am-5pm CT</span>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: PA</p>
                      <p className="text-foreground mt-2">States where a license is required for override commissions: CA, FL, GA, KY, LA, MA, MT, NM, NC, PA, SD, TX, VA, WV, WI</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">E-App Submission:</p>
                      <p className="text-foreground">When submitting E-Apps through IPipeline make sure you use the Agency Code: <span className="font-mono bg-muted px-2 py-1 rounded">4YX</span></p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">E&O Insurance:</p>
                      <p className="text-foreground">E&O Insurance is required to sell products with this carrier.</p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Available Products */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Available Products
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Permanent Life:</p>
                      <ul className="list-disc list-inside space-y-1 text-foreground ml-2">
                        <li>BasicSecure</li>
                        <li>Total Secure</li>
                        <li>FlexLife</li>
                        <li>Peak Life</li>
                        <li>Survivor Life</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">Term Life:</p>
                      <ul className="list-disc list-inside space-y-1 text-foreground ml-2">
                        <li>LSW Term</li>
                        <li>NL Term</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">Retirement Solutions:</p>
                      <ul className="list-disc list-inside space-y-1 text-foreground ml-2">
                        <li>Flexible Premium Annuities</li>
                        <li>Single Premium Annuities</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SBLI */}
            {selectedCarrier?.id === "sbli" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.sbli.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.sbli.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.sbliagent.com/agentauth/login.aspx?ReturnUrl=/agent/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Portal</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Support */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Support
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="text-foreground mb-2">For help please contact one of the following resources:</p>
                      <ul className="list-disc list-inside space-y-2 text-foreground ml-4">
                        <li>For technical support with the e-app, access the QLT/Afficiency resource center for support ticket requests, commissions calculator, product guides and more.</li>
                        <li>Technical Support Email: <a href="mailto:co-pilot.support@unitrustagency.com" className="text-primary hover:underline">co-pilot.support@unitrustagency.com</a></li>
                        <li>General Help Email: <a href="mailto:affigee@afficiency.com" className="text-primary hover:underline">affigee@afficiency.com</a></li>
                        <li>For commissions, agent numbers and other contracting help, submit a support ticket with <a href="mailto:quilityagentservices@sbli.com" className="text-primary hover:underline">quilityagentservices@sbli.com</a></li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Pre-Appointments / Licensing */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Pre-Appointments / Licensing / Additional States
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">No Need to Request Appointment:</p>
                      <p className="text-foreground">Agents must submit at least 3 cases with other carriers to qualify for SBLI contracting. We will be tracking this internally and sending appointments out automatically.</p>
                      <p className="text-foreground mt-2">We automatically select up to 7 states (in addition to your resident state) for the initial appointment.</p>
                      <p className="text-foreground mt-2">You will receive an email with your QLT eApp link after you&apos;ve been appointed and your eApp has been setup.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">To Request Appointment for Additional States:</p>
                      <p className="text-foreground">Email: <a href="mailto:quilityagentservices@sbli.com" className="text-primary hover:underline">quilityagentservices@sbli.com</a></p>
                      <p className="text-foreground text-sm text-muted-foreground mt-1">NOTE: You may only request appointments for states you plan to write in immediately.</p>
                      <p className="text-foreground mt-2">To confirm where you have been appointed, run quotes in various states.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Pre-Appointment Requirements:</p>
                      <p className="text-foreground">You must be pre-appointed in FL and VA to receive override commissions. (These two states will count toward your total of eight.)</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">License Requirements for Override Commissions:</p>
                      <p className="text-foreground">You must be licensed in the following states to receive override commission (but not necessarily appointed): CA, FL, GA, KS, KY, LA, MA, MT, NM, PA, SC, TX, VA, WI.</p>
                      <p className="text-foreground mt-2">If you are operating as a business entity, you must be licensed in (but not appointed in) the following states to receive override commission: CA, GA, KS, KY, LA, MA, MT, NM, PA, SC, TX, UT, VA.</p>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Carrier Notes
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">State Availability:</p>
                      <p className="text-foreground">All states except NY and MT (MT available in 2022).</p>
                    </div>
                  </div>
                </div>

                {/* Commissions */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Commissions Explained
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Commission Structure:</p>
                      <p className="text-foreground">Quility Level Term (20-30 year) is a full-pay product that matches your UniTrust Financial Group contract level.</p>
                      <p className="text-foreground mt-2">For different terms and riders, check with your Agency Owner for specific compensation rates.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Advance Payments:</p>
                      <p className="text-foreground">Commissions are advanced at 75% for premiums up to $3,000 annually.</p>
                      <p className="text-foreground mt-2">Advances are &apos;discounted&apos; above $3,000 to a percentage of premium. You can work with your Agency Owner for advance details above $3,000.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Important Notes:</p>
                      <p className="text-foreground">Commissions are based on the Annual Premium (not monthly).</p>
                      <p className="text-foreground mt-2">$50 annual policy fee is non-commissionable and must be deducted from Annual Commissions to calculate APV.</p>
                      <p className="text-foreground mt-2">APV calculator for monthly commissions available.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Commission Frequency:</p>
                      <p className="text-foreground">Commissions are paid daily, on business days, Monday to Friday.</p>
                      <ul className="list-disc list-inside space-y-1 text-foreground ml-4 mt-2">
                        <li>Any policy written before 9pm ET is paid out on the next business day.</li>
                        <li>Any policy written after 9pm ET is processed on the next business day and will be paid out on the following business day.</li>
                        <li>Any policy written during the weekend or weekday holiday is processed on the next business day.</li>
                        <li>Commissions may take a few days to clear your account depending on your bank.</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Commission Statements:</p>
                      <p className="text-foreground">Are emailed on Saturday mornings.</p>
                      <p className="text-foreground mt-2">Can be accessed by going to sbliagent.com &gt; clicking &apos;Commissions&apos; in the top left &gt; then clicking the green &apos;Search&apos; button to bring up all statements.</p>
                      <p className="text-foreground mt-2">Commission is based on Annual Premium minus the policy fee.</p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "SBLI Easytrak Agent Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1755883631896x366079782060179140/SBLI%20Easytrak%20Term%20Agent%20Guide.pdf" },
                      { title: "SBLI Easytrak Client Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1755883666456x279448314697936520/SBLI%20Easytrak%20Client%20Brochure.pdf" },
                      { title: "SBLI Easytrak Quick Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1755883682621x218476017924857500/SBLI%20Easytrak%20Term%20Fact%20Sheet.pdf" },
                      { title: "SBLI Easytrak UW Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1755883700952x283204196443882270/SBLI%20Easytrak%20UW%20Guidlines.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Transamerica */}
            {selectedCarrier?.id === "transamerica" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.transamerica.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.transamerica.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://ani.transamerica.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Portal</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent md:col-span-2"
                      onClick={() => window.open('https://www.transamerica.com/financial-pro/insurance/FE-express-toolkit', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">FE Express Solution Toolkit</div>
                          <div className="text-sm text-muted-foreground">Product toolkit and resources</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8774544768" className="text-primary hover:underline font-medium">
                        (877) 454-4768
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (800) 535-1325</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 8am-5pm CT</span>
                    </div>
                  </div>
                </div>

                {/* Regional Contacts */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Regional Contacts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">Scott Grode</p>
                      <p className="text-sm text-muted-foreground">Regional Vice President – Midwest Region</p>
                      <p className="text-foreground">Direct: <a href="tel:4802217815" className="text-primary hover:underline">480.221.7815</a></p>
                      <p className="text-foreground">Email: <a href="mailto:Scott.Grode@Transamerica.com" className="text-primary hover:underline">Scott.Grode@Transamerica.com</a></p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">Chris Canarini</p>
                      <p className="text-sm text-muted-foreground">Internal Wholesaler</p>
                      <p className="text-foreground">Direct: <a href="tel:7204887858" className="text-primary hover:underline">720.488.7858</a></p>
                      <p className="text-foreground">Email: <a href="mailto:Christopher.Canarini@Transamerica.com" className="text-primary hover:underline">Christopher.Canarini@Transamerica.com</a></p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">Jason Gilstrap</p>
                      <p className="text-sm text-muted-foreground">Internal Wholesaler</p>
                      <p className="text-foreground">Direct: <a href="tel:7204826370" className="text-primary hover:underline">720.482.6370</a></p>
                      <p className="text-foreground">Email: <a href="mailto:Jason.Gilstrap@Transamerica.com" className="text-primary hover:underline">Jason.Gilstrap@Transamerica.com</a></p>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: KS, LA, MT, PA, TX</p>
                      <p className="text-foreground mt-2">States where a license is required for override commissions: FL, GA, LA, MA, MS, MT, NM, NC, SC, SD, VA, WI</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Quoting Software:</p>
                      <p className="text-foreground">Please access Transamerica&apos;s agent portal to utilize the quoting/illustration software (Transware).</p>
                      <p className="text-foreground text-sm text-muted-foreground mt-1">*Please note - You will need to have a login to Transamerica&apos;s website to access the software.</p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "FE Express Solution UW Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1748462238584x708013455280333400/FE_Express_Solution_Agent_Guide_UW_Guide.pdf" },
                      { title: "FE Express Solution Quick Sheet", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1748462287959x117226894041145390/FE_Express_Solution_Spec_Sheet.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* United Home Life */}
            {selectedCarrier?.id === "united-home-life" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.unitedhomelife.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.unitedhomelife.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://login.agentportal.unitedhomelife.com/apb2cprd.onmicrosoft.com/b2c_1a_signup_signin_passwordreset_ap_agent/oauth2/v2.0/authorize?client_id=1379cbeb-a3ca-457f-9016-232f62df44d7&redirect_uri=https://agentportal.unitedhomelife.com&response_type=code&scope=https://apb2cprd.onmicrosoft.com/ifb_services/AgentPortal.Read%20https://apb2cprd.onmicrosoft.com/ifb_services/AgentPortal.Write%20https://apb2cprd.onmicrosoft.com/ifb_services/LifeAgentManagement.Read%20https://apb2cprd.onmicrosoft.com/ifb_services/LifeAgentManagement.Write%20https://apb2cprd.onmicrosoft.com/ifb_services/Employee.Read%20https://apb2cprd.onmicrosoft.com/ifb_services/VerifyAddress.Read%20https://apb2cprd.onmicrosoft.com/ifb_services/Policies.Read%20openid%20profile%20offline_access&nonce=49d701a32b744f006793aa4a75a24a8eac3sHWX1f&state=e0c9f09b0d58573d66a8de7148c861c20fLPw0oU3&code_challenge=hJkuPCBuYsYjW5MgPz04_vbwejjQsQS1GrGW2SwpQKA&code_challenge_method=S256', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Portal</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8004283001" className="text-primary hover:underline font-medium">
                        (800) 428-3001
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 8am-5pm CT</span>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: AL, GA, KY, LA, OK, OH, PA, TX, VT</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Phone Interviews:</p>
                      <p className="text-foreground">Call <a href="tel:8663336557" className="text-primary hover:underline font-medium">866-333-6557</a></p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">E-Applications:</p>
                      <p className="text-foreground">United Home Life provides E-Apps for Final Expense and Whole Life.</p>
                      <p className="text-foreground mt-2">To access: Log in to unitedhomelife.com, then click on the &apos;E-App Home&apos; tab on the left.</p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with Asurea, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "UHL Term Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1707933503826x413387379021104000/UHL%20Agent%20Guide-Term%20Life.pdf" },
                      { title: "UHL Product Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1707933565058x871637315595289900/UHL%20Product%20Portfolio.pdf" },
                      { title: "UHL Agent Guide - Whole Life Products", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1707933589025x588176712707788400/UHL%20Agent%20Guide-Whole%20Life.pdf" },
                      { title: "UHL Agent Guide - Protector Accidental Plan", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1707933609325x561011741381754560/UHL%20Agent%20Guide-Protector%20AD.pdf" },
                      { title: "UHL Agent Guide - Child Rider", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1707933631579x847018316152435000/UHL%20Agent%20Guide-Child%20Rider.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Corebridge Financial */}
            {selectedCarrier?.id === "corebridge" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.aig.com/individual', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.aig.com/individual</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8002478837" className="text-primary hover:underline font-medium">
                        (800) 247-8837
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (800) 915-9937</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">7am-6pm CT | Mon-Fri</span>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Product Availability:</p>
                      <p className="text-foreground">AIG products are not available in NY.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: VA</p>
                      <p className="text-foreground mt-2">A partial pre-appointment process is required in ALL STATES. AIG uses application forms with agent numbers pre-encoded; therefore, an agent number must be issued before you can obtain application documents. Please ask your Agency Owner to request an appointment for you.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Applications:</p>
                      <p className="text-foreground">AIG uses application forms with agent numbers pre-encoded; therefore, an agent number must be issued before you can obtain application documents. Please ask your Agency Owner to request an appointment for you.</p>
                      <p className="text-foreground mt-2 text-sm bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <span className="font-semibold">DO NOT SHARE APPLICATIONS.</span> Contracting is required first. The applications are agent-specific with special coding on the bottom.
                      </p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "AIG / Corebridge GIWL Brochure", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1740522330227x603363045565577300/AIG%3ACorebridge%20GIWL%20Brochure.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Ethos */}
            {selectedCarrier?.id === "ethos" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.ethos.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.ethos.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://agents.ethoslife.com/login', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Portal</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Platform Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Platform Information
                  </h3>
                  <div className="space-y-4 text-base leading-relaxed">
                    <div>
                      <p className="text-foreground">This new digital life platform offers FE and Term products with 100% instant-decision and instant-issue!</p>
                    </div>
                  </div>
                </div>

                {/* Product Resources */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <FileText className="w-5 h-5" />
                    Product Resources & Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "Ethos Field Underwriting Guide", url: "https://4681fae44a74582adad5b889aa1a3671.cdn.bubble.io/d200/f1705096751128x580525474543211400/Ethos%20Field%20Underwriting%20Guide%20%28IUL%2BSpectrum%29_23Q4_December.pdf" },
                    ].map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left hover:bg-accent"
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Download className="w-5 h-5 text-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate text-foreground">{doc.title}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* F&G Annuities & Life */}
            {selectedCarrier?.id === "fg-annuities" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://www.fglife.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.fglife.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8004456758" className="text-primary hover:underline font-medium">
                        (800) 445-6758
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (800) 281-5777</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Mon-Fri | 8am-6:30pm ET</span>
                    </div>
                  </div>
                </div>

                {/* Carrier Notes */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <div className="space-y-6 text-base leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Licensing Requirements:</p>
                      <p className="text-foreground">Pre-appointment States: AL, DE, DC, GA, IA, LA, MA, NC, NH, NM, PA, PR, SC, TX, UT, WI, WY</p>
                      <p className="text-foreground mt-2">States where a license is required for override commissions: AL, FL, KY, LA, MD, MS, MT, NM, PA, SC, UT, WV</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground mb-2">Training Requirements:</p>
                      <p className="text-foreground">F&G product training must be completed before soliciting annuity business.</p>
                      <p className="text-foreground mt-2">F&G allows agents to begin training without being pre-appointed.</p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-foreground">Additional resources, such as applications, can be found by visiting the carrier&apos;s website and accessing its agent portal once you have completed the contracting process.</p>
                      <p className="text-foreground mt-3">Your compensation depends on your commission level with UniTrust Financial Group, the product you&apos;re selling, age of your client and sometimes the state you&apos;re selling in. Please contact your manager if you have questions about your commission for a certain product.</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Liberty Bankers */}
            {selectedCarrier?.id === "liberty-bankers" && (
              <>
                {/* Website Links */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Globe className="w-5 h-5" />
                    Quick Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://lbig.com/', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Website</div>
                          <div className="text-sm text-muted-foreground">www.lbig.com</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-4 px-4 text-left hover:bg-accent"
                      onClick={() => window.open('https://agent.lbig.com/annuitylogin', '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Globe className="w-5 h-5 text-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-base text-foreground">Agent Portal</div>
                          <div className="text-sm text-muted-foreground">Access your portal</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Phone className="w-5 h-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground" />
                      <a href="tel:8007314300" className="text-primary hover:underline font-medium">
                        (800) 731-4300
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">Fax: (888) 525-5002</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Default content for other carriers */}
            {selectedCarrier?.id !== "american-amicable" && selectedCarrier?.id !== "american-home-life" && selectedCarrier?.id !== "americo" && selectedCarrier?.id !== "foresters" && selectedCarrier?.id !== "legal-general" && selectedCarrier?.id !== "mutual-omaha" && selectedCarrier?.id !== "national-life" && selectedCarrier?.id !== "sbli" && selectedCarrier?.id !== "transamerica" && selectedCarrier?.id !== "united-home-life" && selectedCarrier?.id !== "corebridge" && selectedCarrier?.id !== "ethos" && selectedCarrier?.id !== "fg-annuities" && selectedCarrier?.id !== "liberty-bankers" && (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Content for {selectedCarrier?.name} will be added here.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

