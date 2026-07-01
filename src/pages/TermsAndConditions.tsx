import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="mb-6">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </div>

        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Terms and Conditions</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <div className="space-y-6 text-foreground">
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing and using this platform, you accept and agree to be bound by the terms and provision of this agreement. 
                  If you do not agree to abide by the above, please do not use this service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. Use License</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Permission is granted to temporarily access the materials on this platform for personal, non-commercial transitory viewing only. 
                  This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Modify or copy the materials</li>
                  <li>Use the materials for any commercial purpose or for any public display</li>
                  <li>Attempt to reverse engineer any software contained on the platform</li>
                  <li>Remove any copyright or other proprietary notations from the materials</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. User Account</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility 
                  for all activities that occur under your account or password. You must notify us immediately of any unauthorized use of 
                  your account or any other breach of security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. User Conduct</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You agree to use the platform only for lawful purposes and in a way that does not infringe the rights of, restrict or 
                  inhibit anyone else's use and enjoyment of the platform. Prohibited behavior includes:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Harassing or causing distress or inconvenience to any person</li>
                  <li>Transmitting obscene or offensive content</li>
                  <li>Disrupting the normal flow of dialogue within the platform</li>
                  <li>Violating any applicable laws or regulations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The platform and its original content, features, and functionality are and will remain the exclusive property of the 
                  platform and its licensors. The platform is protected by copyright, trademark, and other laws. Our trademarks and trade 
                  dress may not be used in connection with any product or service without our prior written consent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  In no event shall the platform, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable 
                  for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, 
                  data, use, goodwill, or other intangible losses, resulting from your use of the platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your account and bar access to the platform immediately, without prior notice or liability, 
                  for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the 
                  platform will immediately cease.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, 
                  we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will 
                  be determined at our sole discretion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms and Conditions, please contact us through the appropriate channels provided 
                  on the platform.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

