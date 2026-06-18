import decimal
import razorpay
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from orders.models import Order
from .models import Bill

# Initialize client if keys are set (to avoid crash during build/test if keys aren't loaded)
client = None
if hasattr(settings, 'RAZORPAY_KEY_ID') and hasattr(settings, 'RAZORPAY_KEY_SECRET'):
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    except Exception as e:
        print(f"Error initializing Razorpay client: {e}")

class CreateRazorpayOrderView(APIView):
    def post(self, request):
        order_id = request.data.get("order_id")
        amount = request.data.get("amount")
        
        if order_id:
            try:
                order = Order.objects.get(id=order_id)
                bill, created = Bill.objects.get_or_create(
                    order=order,
                    defaults={
                        'subtotal': 0,
                        'gst': 0,
                        'service_charge': 0,
                        'total': 0
                    }
                )
                if created or bill.total == 0:
                    subtotal = sum(item.price * item.quantity for item in order.items.all())
                    gst = subtotal * decimal.Decimal('0.05')
                    service_charge = subtotal * decimal.Decimal('0.02')
                    total = subtotal + gst + service_charge
                    bill.subtotal = subtotal
                    bill.gst = gst
                    bill.service_charge = service_charge
                    bill.total = total
                    bill.save()
                
                amount_paise = int(bill.total * 100)
            except Order.DoesNotExist:
                return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        elif amount:
            amount_paise = int(float(amount) * 100)
        else:
            return Response({"error": "order_id or amount is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if not client:
            order_id_str = f"order_mock_{order_id or '123'}"
            if order_id:
                try:
                    bill.razorpay_order_id = order_id_str
                    bill.save()
                except:
                    pass
            return Response({
                "status": "mock_success",
                "order_id": order_id_str,
                "amount": amount_paise,
                "currency": "INR",
                "key_id": getattr(settings, 'RAZORPAY_KEY_ID', 'mock_key')
            })

        try:
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "payment_capture": 1
            }
            razorpay_order = client.order.create(data=order_data)
            
            if order_id:
                bill.razorpay_order_id = razorpay_order["id"]
                bill.save()
                
            return Response({
                "status": "success",
                "order_id": razorpay_order["id"],
                "amount": razorpay_order["amount"],
                "currency": razorpay_order["currency"],
                "key_id": settings.RAZORPAY_KEY_ID
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyRazorpayPaymentView(APIView):
    def post(self, request):
        razorpay_order_id = request.data.get("razorpay_order_id")
        razorpay_payment_id = request.data.get("razorpay_payment_id")
        razorpay_signature = request.data.get("razorpay_signature")
        order_id = request.data.get("order_id")  # Optionally lock/mark the order bill as paid
        
        if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
            return Response({"error": "All signature credentials are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        is_verified = False
        
        if not client or razorpay_order_id.startswith("order_mock"):
            is_verified = True
        else:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            try:
                client.utility.verify_payment_signature(params_dict)
                is_verified = True
            except Exception as e:
                return Response({"status": "failed", "message": "Payment verification failed.", "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if is_verified:
            # Mark the bill as paid if order_id is provided
            if order_id:
                try:
                    order = Order.objects.get(id=order_id)
                    bill, created = Bill.objects.get_or_create(
                        order=order,
                        defaults={
                            'subtotal': 0,
                            'gst': 0,
                            'service_charge': 0,
                            'total': 0
                        }
                    )
                    if created or bill.total == 0:
                        subtotal = sum(item.price * item.quantity for item in order.items.all())
                        gst = subtotal * decimal.Decimal('0.05')
                        service_charge = subtotal * decimal.Decimal('0.02')
                        total = subtotal + gst + service_charge
                        bill.subtotal = subtotal
                        bill.gst = gst
                        bill.service_charge = service_charge
                        bill.total = total
                    
                    bill.is_paid = True
                    bill.razorpay_order_id = razorpay_order_id
                    bill.razorpay_payment_id = razorpay_payment_id
                    bill.razorpay_signature = razorpay_signature
                    bill.save()
                except Order.DoesNotExist:
                    pass
            return Response({"status": "success", "message": "Payment verified and bill updated successfully."})

class GenerateBillView(APIView):
    def post(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        
        # Check if bill already exists
        bill, created = Bill.objects.get_or_create(
            order=order,
            defaults={
                'subtotal': 0,
                'gst': 0,
                'service_charge': 0,
                'total': 0
            }
        )
        
        if created or bill.total == 0:
            # Calculate from current order items
            subtotal = sum(item.price * item.quantity for item in order.items.all())
            gst = subtotal * decimal.Decimal('0.05')
            service_charge = subtotal * decimal.Decimal('0.02')
            total = subtotal + gst + service_charge
            
            bill.subtotal = subtotal
            bill.gst = gst
            bill.service_charge = service_charge
            bill.total = total
            bill.save()
            
        return Response({
            "status": "success",
            "bill_id": bill.id,
            "order_id": order.id,
            "subtotal": str(bill.subtotal),
            "gst": str(bill.gst),
            "service_charge": str(bill.service_charge),
            "total": str(bill.total),
            "is_paid": bill.is_paid
        })

class InvoiceHTMLView(APIView):
    def get(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        try:
            bill = order.bill
        except Bill.DoesNotExist:
            subtotal = sum(item.price * item.quantity for item in order.items.all())
            gst = subtotal * decimal.Decimal('0.05')
            service_charge = subtotal * decimal.Decimal('0.02')
            total = subtotal + gst + service_charge
            bill = Bill.objects.create(
                order=order,
                subtotal=subtotal,
                gst=gst,
                service_charge=service_charge,
                total=total
            )
            
        # Build beautiful printable HTML
        items_html = ""
        for item in order.items.all():
            items_html += f"""
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">{item.menu_item.name}</td>
                <td style="padding: 10px 0; text-align: center; border-bottom: 1px solid #eee;">{item.quantity}</td>
                <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #eee;">₹{item.price}</td>
                <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #eee;">₹{item.price * item.quantity}</td>
            </tr>
            """
            
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice - Order #{order.id}</title>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                    margin: 0;
                    padding: 40px;
                    color: #333;
                    background: #fff;
                }}
                .invoice-box {{
                    max-width: 800px;
                    margin: auto;
                    padding: 30px;
                    border: 1px solid #eee;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
                    font-size: 16px;
                    line-height: 24px;
                }}
                .header {{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px solid #dc2626;
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }}
                .company-info {{
                    text-align: right;
                }}
                .details {{
                    margin-bottom: 30px;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }}
                th {{
                    background: #f8f8f8;
                    font-weight: bold;
                    padding: 10px;
                    border-bottom: 2px solid #ddd;
                }}
                .totals {{
                    text-align: right;
                    font-size: 16px;
                }}
                .totals table {{
                    width: 300px;
                    margin-left: auto;
                }}
                .totals td {{
                    padding: 6px 0;
                }}
                .totals .grand-total {{
                    font-size: 20px;
                    font-weight: bold;
                    color: #dc2626;
                    border-top: 2px double #ddd;
                    padding-top: 10px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 40px;
                    font-size: 12px;
                    color: #999;
                    border-top: 1px solid #eee;
                    padding-top: 20px;
                }}
                @media print {{
                    body {{ padding: 0; }}
                    .invoice-box {{ border: none; box-shadow: none; }}
                    .print-btn {{ display: none; }}
                }}
            </style>
        </head>
        <body>
            <div class="invoice-box">
                <div style="text-align: right; margin-bottom: 20px;">
                    <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">🖨️ Print Invoice</button>
                </div>
                <div class="header">
                    <div>
                        <h1 style="margin: 0; color: #dc2626; font-size: 28px;">RED VELVET BISTRO</h1>
                        <p style="margin: 5px 0 0 0; color: #666;">Table Order Receipt</p>
                    </div>
                    <div class="company-info">
                        <p style="margin: 0; font-weight: bold;">Order #{order.id}</p>
                        <p style="margin: 3px 0 0 0;">Table: {order.table.number}</p>
                        <p style="margin: 3px 0 0 0;">Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}</p>
                    </div>
                </div>
                
                <div class="details">
                    <p style="margin: 0;"><strong>Customer Mobile:</strong> {order.user.mobile if order.user else 'N/A'}</p>
                    <p style="margin: 3px 0 0 0;"><strong>Payment Status:</strong> <span style="color: {'#10b981' if bill.is_paid else '#f59e0b'}; font-weight: bold;">{'PAID' if bill.is_paid else 'UNPAID'}</span></p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Item</th>
                            <th style="text-align: center; width: 80px;">Qty</th>
                            <th style="text-align: right; width: 120px;">Price</th>
                            <th style="text-align: right; width: 120px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                </table>
                
                <div class="totals">
                    <table>
                        <tr>
                            <td>Subtotal:</td>
                            <td>₹{bill.subtotal}</td>
                        </tr>
                        <tr>
                            <td>GST (5%):</td>
                            <td>₹{bill.gst}</td>
                        </tr>
                        <tr>
                            <td>Service Charge (2%):</td>
                            <td>₹{bill.service_charge}</td>
                        </tr>
                        <tr class="grand-total">
                            <td>Total:</td>
                            <td>₹{bill.total}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="footer">
                    <p>Thank you for dining with us!</p>
                    <p>Red Velvet Bistro &bull; Signature QR Dining System</p>
                </div>
            </div>
        </body>
        </html>
        """
        return HttpResponse(html_content, content_type="text/html")
