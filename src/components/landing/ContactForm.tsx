"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { Loader2, Mail, MessageSquare, Send, User, Phone } from "lucide-react";

interface ContactFormData {
    name: string;
    email: string;
    phone?: string;
    orgSize: string;
    message: string;
    type: "SUPPORT" | "SALES" | "INQUIRY";
}

export function ContactForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormData>();

    const onSubmit = async (_data: ContactFormData) => {
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        toast.success("Message sent! Our team will get back to you shortly.");
        reset();
    };

    return (
        <div className="glass-dark rounded-2xl border border-white/10 p-8 shadow-2xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-200">Full Name</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input
                                id="name"
                                placeholder="John Doe"
                                className="pl-10 bg-slate-900/50 border-slate-700 text-white focus:ring-teal-500"
                                {...register("name", { required: "Name is required" })}
                                disabled={isSubmitting}
                            />
                        </div>
                        {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-200">Work Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="john@company.com"
                                className="pl-10 bg-slate-900/50 border-slate-700 text-white focus:ring-teal-500"
                                {...register("email", {
                                    required: "Email is required",
                                    pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
                                })}
                                disabled={isSubmitting}
                            />
                        </div>
                        {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                    </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-slate-200">Phone Number (Optional)</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input
                                id="phone"
                                placeholder="+1 (555) 000-0000"
                                className="pl-10 bg-slate-900/50 border-slate-700 text-white focus:ring-teal-500"
                                {...register("phone")}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="orgSize" className="text-slate-200">Organisation Size</Label>
                        <select
                            id="orgSize"
                            className="w-full rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 disabled:opacity-50"
                            {...register("orgSize", { required: "Select org size" })}
                            disabled={isSubmitting}
                        >
                            <option value="" className="bg-slate-900">Select size...</option>
                            <option value="1-50" className="bg-slate-900">1 - 50 employees</option>
                            <option value="51-500" className="bg-slate-900">51 - 500 employees</option>
                            <option value="500+" className="bg-slate-900">500+ employees</option>
                        </select>
                        {errors.orgSize && <p className="text-xs text-red-400">{errors.orgSize.message}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="type" className="text-slate-200">Inquiry Type</Label>
                    <select
                        id="type"
                        className="w-full rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 disabled:opacity-50"
                        {...register("type", { required: true })}
                        disabled={isSubmitting}
                    >
                        <option value="SALES" className="bg-slate-900">Sales Inquiry</option>
                        <option value="SUPPORT" className="bg-slate-900">Technical Support</option>
                        <option value="INQUIRY" className="bg-slate-900">General Information</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="message" className="text-slate-200">Message</Label>
                    <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                        <textarea
                            id="message"
                            rows={4}
                            placeholder="Tell us about your needs..."
                            className="w-full rounded-md border border-slate-700 bg-slate-900/50 pl-10 pt-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                            {...register("message", { required: "Message is required" })}
                            disabled={isSubmitting}
                        />
                    </div>
                    {errors.message && <p className="text-xs text-red-400">{errors.message.message}</p>}
                </div>

                <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-base font-bold h-12" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2 h-5 w-5" />
                            Send Message
                        </>
                    )}
                </Button>
            </form>
        </div>
    );
}
