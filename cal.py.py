#Auther:Vishwas Shetty
#Programming Language:Python
#Progarm:To Create Simple Calculator
#Start Date:30-11-2019
#End Date:1-12-2019

import tkinter
from tkinter import*
from tkinter import messagebox

val=""
num1=0
num2=0
operator=""
res=0
flag=0;
def button_clicked(n):
    global val
    val=val+str(n)
    value.set(val)

def operator_clicked(op):
    global operator
    global val
    global num1
    global flag
   
  #  if flag==0:
    operator=op
    num1=int(val)
    flag=1
    val=val+op
    value.set(val)
   # else:
    #    equal_clicked()
     #   flag=0
      #  operator=""
       # return operator_clicked(op)
        #operator=""
        #operator=op
        #num1=int(val)
        #val=val+operator
        #value.set(val)
        


def equal_clicked():
    global val
    global operator
    global num1
    global num2
    global res
    #global flag
    if operator=="+":
        num2=int(val.split("+")[1])
        res=num1+num2
        val=""
        val=str(res)
        value.set(val)  
       
    if operator=="-":
           
        num2=int(val.split("-")[1])
        res=num1-num2
        val=""
        val=str(res)
        value.set(val)  
       
    if operator=="/":
        num2=int(val.split("/")[1])
        if num2==0:
           messagebox.showerror("Error","cannot devisible by zero")
           num1=""
           #flag=0
           val=""
           value.set(val)
        else:
            #res=round(num1/num2,2)
            res=int(num1/num2)
            val=""
            val=str((res))
            value.set(val)  
        
    if operator=="*":
           
        num2=int(val.split("*")[1])
        res=num1*num2
        val=""
        val=str(res)
        value.set(val)  
    
def clearButton_clicked():
    global num1
    global val
    global flag
    #flag=0
    num1=""
    val=""
    value.set(val)
      

root=tkinter.Tk()
root.geometry("250x400+300+300")
root.title("Calculator")
root.resizable(10,10)
value=StringVar()
label1=Label(
    root,
    text="",
    anchor=SE,
    bg="#ffffff",
    fg="#000000",
    font=("verdana",20),
   textvariable=value,
)
label1.pack(expand=True,fill="both")

btnrow1=Frame(root,bg="cyan")
btnrow1.pack(expand=True,fill="both")
btnrow2=Frame(root)
btnrow2.pack(expand=True,fill="both")
btnrow3=Frame(root,bg="cyan")
btnrow3.pack(expand=True,fill="both")
btnrow4=Frame(root)
btnrow4.pack(expand=True,fill="both")

#button row 1 buttons

btn1=Button(
    btnrow1,
    text="1",
    font=("verdana",22)
    ,border="0",bg="cyan",
    relief=GROOVE,
    command=lambda:button_clicked(1)
    
)
btn1.pack(side=LEFT,expand=True,fill="both")

btn2=Button(
    btnrow1,
    text="2",
    font=("verdana",22)
    ,border="0",bg="cyan",
      command=lambda:button_clicked(2),
)
btn2.pack(side=LEFT,expand=True,fill="both")

btn3=Button(
    btnrow1,
    text="3",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(3),
)
btn3.pack(side=LEFT,expand=True,fill="both")

btn4=Button(
    btnrow1,
    text="4",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(4),
)
btn4.pack(side=LEFT,expand=True,fill="both")

#button row 2 buttons
btn5=Button(
    btnrow2,
    text="5",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(5),
)
btn5.pack(side=LEFT,expand=True,fill="both")

btn6=Button(
    btnrow2,
    text="6",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(6),
)
btn6.pack(side=LEFT,expand=True,fill="both")

btn7=Button(
    btnrow2,
    text="7",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(7),
)
btn7.pack(side=LEFT,expand=True,fill="both")

btn8=Button(
    btnrow2,
    text="8",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(8),
)
btn8.pack(side=LEFT,expand=True,fill="both")

#btnrow3 buttons
btn9=Button(
    btnrow3,
    text="9",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(9),
)
btn9.pack(side=LEFT,expand=True,fill="both")

btn10=Button(
    btnrow3,
    text="0",
    font=("verdana",22),border="0",bg="cyan",
     command=lambda:button_clicked(0),
)
btn10.pack(side=LEFT,expand=True,fill="both")

btnplus=Button(
    btnrow3,
    text="+",
    font=("verdana",19),border="0",bg="cyan",
    command=lambda:operator_clicked("+"),
)
btnplus.pack(side=LEFT,expand=True,fill="both")

btnminus=Button(
    btnrow3,
    text="-",
    font=("verdana",24),border="0",bg="cyan"
    ,command=lambda:operator_clicked("-"),
)
btnminus.pack(side=LEFT,expand=True,fill="both")

#btnrow4 buttons
btndiv=Button(
    btnrow4,
    text="/",
    font=("verdana",23),border="0",bg="cyan"
     ,command=lambda:operator_clicked("/"),
    
)
btndiv.pack(side=LEFT,expand=True,fill="both")

btnmul=Button(
    btnrow4,
    text="x",
    font=("verdana",22),border="0",bg="cyan"
     ,command=lambda:operator_clicked("*"),
)
btnmul.pack(side=LEFT,expand=True,fill="both")

btneq=Button(
    btnrow4,
    text="=",
    font=("verdana",18),border="0",bg="cyan",
    command=lambda:equal_clicked()
)
btneq.pack(side=LEFT,expand=True,fill="both")

btncls=Button(
    btnrow4,
    text="c",
    font=("verdana",22),border="0",bg="cyan",
    command=lambda:clearButton_clicked(),
)
btncls.pack(side=LEFT,expand=True,fill="both")


root.mainloop()