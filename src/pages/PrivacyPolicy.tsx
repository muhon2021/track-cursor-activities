import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <div className="space-y-6 text-foreground">
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard 
                  your information when you use our platform. Please read this privacy policy carefully. If you do not agree with the terms 
                  of this privacy policy, please do not access the platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We may collect information about you in a variety of ways. The information we may collect on the platform includes:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and telephone number, 
                  that you voluntarily give to us when you register with the platform or when you choose to participate in various activities 
                  related to the platform.</li>
                  <li><strong>Derived Data:</strong> Information our servers automatically collect when you access the platform, such as your IP address, 
                  your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing 
                  the platform.</li>
                  <li><strong>Financial Data:</strong> Financial information, such as data related to your payment method (e.g., valid credit card number, 
                  card brand, expiration date) that we may collect when you purchase, order, return, exchange, or request information about our 
                  services from the platform.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. 
                  Specifically, we may use information collected about you via the platform to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Create and manage your account</li>
                  <li>Process your transactions and send you related information</li>
                  <li>Email you regarding your account or order</li>
                  <li>Fulfill and manage purchases, orders, payments, and other transactions related to the platform</li>
                  <li>Generate a personal profile about you to make future visits more personalized</li>
                  <li>Increase the efficiency and operation of the platform</li>
                  <li>Monitor and analyze usage and trends to improve your experience with the platform</li>
                  <li>Notify you of updates to the platform</li>
                  <li>Perform other business activities as needed</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. Disclosure of Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to 
                  legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of 
                  others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
                  <li><strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, 
                  any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                  <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or 
                  on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Security of Your Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use administrative, technical, and physical security measures to help protect your personal information. While we have taken 
                  reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures 
                  are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse. 
                  Any information disclosed online is vulnerable to interception and misuse by unauthorized parties. Therefore, we cannot guarantee 
                  complete security if you provide personal information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Depending on your location, you may have the following rights regarding your personal information:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>The right to access – You have the right to request copies of your personal data</li>
                  <li>The right to rectification – You have the right to request that we correct any information you believe is inaccurate</li>
                  <li>The right to erasure – You have the right to request that we erase your personal data, under certain conditions</li>
                  <li>The right to restrict processing – You have the right to request that we restrict the processing of your personal data</li>
                  <li>The right to object to processing – You have the right to object to our processing of your personal data</li>
                  <li>The right to data portability – You have the right to request that we transfer the data that we have collected to another organization</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. Cookies and Tracking Technologies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may use cookies, web beacons, tracking pixels, and other tracking technologies on the platform to help customize the platform 
                  and improve your experience. When you access the platform, your personal information is not collected through the use of tracking 
                  technology. Most browsers are set to accept cookies by default. You can remove or reject cookies, but be aware that such action 
                  could affect the availability and functionality of the platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Policy for Children</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We do not knowingly solicit information from or market to children under the age of 13. If we learn that we have collected personal 
                  information from a child under age 13 without verification of parental consent, we will delete that information as quickly as possible. 
                  If you become aware of any data we have collected from children under age 13, please contact us.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Changes to This Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time in order to reflect changes to our practices or for other operational, legal, 
                  or regulatory reasons. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" 
                  date. You are advised to review this Privacy Policy periodically for any changes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">10. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions or comments about this Privacy Policy, please contact us through the appropriate channels provided on the platform.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

